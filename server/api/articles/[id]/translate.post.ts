import { z } from 'zod'
import { type ClientPlan, Language } from '~~/generated/zenstack/models'

const TRANSLATION_PLANS: ClientPlan[] = ['PRO', 'PREMIUM', 'CUSTOM']
export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const user = await requireUser(event, { minRole: 'admin', clientSite: true })
  await requireTenantScope(event, 'AI_USE', user.clientSiteId)
  await requireArticleAccess(event, id)

  await ensureMinAccountAge(event, user.id)

  const body = await readValidatedBody(
    event,
    z.object({
      language: z.enum(Language).optional(),
      replace: z.boolean().default(false),
      expectedUpdatedAt: z.iso.datetime().nullable().optional(),
      background: z.boolean().default(false),
    }).parse,
  )

  const db = await getEnhancedPrisma(user)

  const clientSite = await db.clientSite.findUnique({
    where: { id: user.clientSiteId },
    select: { plan: true, language: true },
  })
  if (!clientSite) throw createError({ statusCode: 404, message: t('common.errors.clientNotFound')! })

  if (!TRANSLATION_PLANS.includes(clientSite.plan) || !(await hasActiveFeature(db, user.clientSiteId, 'AI')))
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const article = await db.article.findUnique({
    where: { id },
    select: {
      id: true,
      editVersion: true,
      language: true,
      title: true,
      excerpt: true,
      content: true,
      status: true,
      answer: true,
      keyTakeaways: true,
      faq: true,
    },
  })
  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

  const sourceLang = article.language
  const targetLang = body.language ?? LANGUAGE_OPTIONS.find((candidate) => candidate !== sourceLang)
  if (!targetLang || targetLang === sourceLang)
    throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const conflict = () =>
    createError({
      statusCode: 409,
      message: t('articles.editor.history.conflict')!,
      data: { code: 'ARTICLE_EDIT_CONFLICT' },
    })
  let existing = await db.articleTranslation.findUnique({
    where: { articleId_language: { articleId: article.id, language: targetLang } },
    select: { id: true, updatedAt: true, status: true, translationStartedAt: true },
  })
  if (existing) {
    if (existing.status === 'TRANSLATING' || existing.translationStartedAt) throw conflict()
    if (!body.replace) throw conflict()
    if (body.expectedUpdatedAt === undefined)
      throw createError({
        statusCode: 428,
        message: t('articles.editor.history.versionRequired')!,
        data: { code: 'ARTICLE_VERSION_REQUIRED' },
      })
    const expected = body.expectedUpdatedAt === null ? null : new Date(body.expectedUpdatedAt).getTime()
    if ((existing.updatedAt?.getTime() ?? null) !== expected) throw conflict()
    if (existing.status === 'PUBLISHED') await requireTenantScope(event, 'ARTICLE_PUBLISH', user.clientSiteId)
  } else if (body.replace) throw conflict()

  let backgroundTranslation: ArticleTranslationRow | undefined
  if (body.background) {
    const claimedAt = nextTranslationVersion(existing?.updatedAt)
    if (existing) {
      const claimed = await db.articleTranslation.updateMany({
        where: {
          id: existing.id,
          clientSiteId: user.clientSiteId,
          updatedAt: existing.updatedAt,
          status: existing.status,
          translationStartedAt: null,
        },
        data: {
          status: existing.status === 'PUBLISHED' ? 'PUBLISHED' : 'TRANSLATING',
          translationStartedAt: claimedAt,
          error: null,
          updatedAt: claimedAt,
        },
      })
      if (claimed.count !== 1) throw conflict()
      backgroundTranslation = await db.articleTranslation.findUniqueOrThrow({
        where: { id: existing.id },
        select: translationSelect,
      })
    } else {
      backgroundTranslation = await db.articleTranslation
        .create({
          data: {
            articleId: article.id,
            clientSiteId: user.clientSiteId,
            language: targetLang,
            status: 'TRANSLATING',
            translationStartedAt: claimedAt,
            source: 'AI',
            updatedAt: claimedAt,
          },
          select: translationSelect,
        })
        .catch((error: unknown) => {
          if (isUniqueViolation(error)) throw conflict()
          throw error
        })
    }
    existing = {
      id: backgroundTranslation.id,
      updatedAt: new Date(backgroundTranslation.updatedAt!),
      status: backgroundTranslation.status,
      translationStartedAt: claimedAt,
    }
  }

  const translate = async () => {
    const { usage, slug: baseSlug, ...translated } = await generateTranslation(article, targetLang)

    try {
      await recordAiUsage(
        user.clientSiteId,
        usage.totalTokens || 0,
        'TRANSLATE_ARTICLE',
        { articleId: article.id, targetLang, usage },
        event,
      )
    } catch (error) {
      await reportCaughtError('Translation usage recording failed', error, {
        clientSiteId: user.clientSiteId,
        articleId: article.id,
      })
    }

    const slug = await dedupeTranslationSlug(db, baseSlug, user.clientSiteId, targetLang, article.id)

    const translation = await db
      .$transaction(async (tx) => {
        // A shared row lock prevents a source edit between this check and the translation commit.
        const source = await tx.$queryRaw<{ editVersion: number }[]>`
      SELECT "editVersion" FROM "Article"
      WHERE "id" = ${article.id} AND "clientSiteId" = ${user.clientSiteId} AND "deletedAt" IS NULL
      FOR SHARE
    `
        if (source[0]?.editVersion !== article.editVersion) throw conflict()
        const data = {
          slug,
          title: translated.title,
          excerpt: translated.excerpt,
          content: sanitizeHtml(translated.content),
          answer: translated.answer,
          keyTakeaways: translated.keyTakeaways,
          faq: translated.faq,
          status: 'READY' as const,
          source: 'AI' as const,
          model: aiModelId('translation'),
          usage: toDatabaseJson(usage),
          error: null,
          translatedAt: new Date(),
          translationStartedAt: null,
          updatedAt: nextTranslationVersion(existing?.updatedAt),
        }
        if (!existing)
          return tx.articleTranslation.create({
            data: { ...data, articleId: article.id, clientSiteId: user.clientSiteId, language: targetLang },
            select: translationSelect,
          })
        const updated = await tx.articleTranslation.updateMany({
          where: {
            id: existing.id,
            clientSiteId: user.clientSiteId,
            updatedAt: existing.updatedAt,
            status: existing.status,
          },
          data,
        })
        if (updated.count !== 1) throw conflict()
        return tx.articleTranslation.findUniqueOrThrow({ where: { id: existing.id }, select: translationSelect })
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) throw conflict()
        throw error
      })

    await invalidateFeed(user.clientSiteId)

    await syncArticleMediaUsages(prisma, {
      clientSiteId: user.clientSiteId,
      articleId: article.id,
      articleTranslationId: translation.id,
      language: translation.language,
      content: translation.content,
    })

    try {
      await logAction({
        action: 'TRANSLATE_ARTICLE',
        userId: user.id,
        clientSiteId: user.clientSiteId,
        ip: getIp(event),
        metadata: { articleId: article.id, translationId: translation.id, targetLang },
      })
    } catch (error) {
      await reportCaughtError('Translation audit failed after persistence', error, {
        articleId: article.id,
        translationId: translation.id,
        clientSiteId: user.clientSiteId,
      })
    }

    return { translation }
  }

  if (backgroundTranslation) {
    const claim = existing!
    const work = translate().catch(async (error: unknown) => {
      try {
        await db.articleTranslation.updateMany({
          where: {
            id: claim.id,
            clientSiteId: user.clientSiteId,
            status: claim.status,
            updatedAt: claim.updatedAt,
            translationStartedAt: claim.translationStartedAt,
          },
          data: {
            status: claim.status === 'PUBLISHED' ? 'PUBLISHED' : 'FAILED',
            translationStartedAt: null,
            error: t('common.messages.operationFailed')!,
            updatedAt: nextTranslationVersion(claim.updatedAt),
          },
        })
      } catch (cleanupError) {
        await reportCaughtError('Background translation failure state could not be saved', cleanupError, {
          articleId: article.id,
          translationId: claim.id,
          clientSiteId: user.clientSiteId,
        })
      }
      await reportCaughtError('Background translation failed', error, {
        articleId: article.id,
        translationId: claim.id,
        clientSiteId: user.clientSiteId,
      })
    })
    event.waitUntil(work)
    setResponseStatus(event, 202)
    return { translation: backgroundTranslation }
  }
  return translate()
})

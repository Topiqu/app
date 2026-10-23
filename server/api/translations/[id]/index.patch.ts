import { z } from 'zod'

const BodySchema = z.object({
  expectedUpdatedAt: z.iso.datetime().nullable().optional(),
  title: z.string().min(1).max(255).optional(),
  excerpt: z.string().max(500).nullable().optional(),
  content: z.string().min(1).max(50000).optional(),
  status: z.enum(['READY', 'PUBLISHED']).optional(),
})

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const { user, db } = await requireDb(event, { minRole: 'admin', clientSite: true })

  const body = await readValidatedBody(event, BodySchema.parse)
  if (body.expectedUpdatedAt === undefined)
    throw createError({
      statusCode: 428,
      message: t('articles.editor.history.versionRequired')!,
      data: { code: 'ARTICLE_VERSION_REQUIRED' },
    })

  const translation = await db.articleTranslation.findFirst({
    where: { id, clientSiteId: user.clientSiteId! },
    select: {
      id: true,
      articleId: true,
      language: true,
      slug: true,
      title: true,
      content: true,
      status: true,
      clientSite: { select: { publishToWeb: true } },
    },
  })
  if (translation) await requireArticleAccess(event, translation.articleId)
  if (body.status === 'PUBLISHED' || translation?.status === 'PUBLISHED')
    await requireTenantScope(event, 'ARTICLE_PUBLISH')
  if (!translation)
    throw createError({ statusCode: 404, message: t('common.errors.notFound') ?? 'Translation not found' })

  const nextTitle = body.title ?? translation.title
  const nextContent = body.content ?? translation.content
  const nextStatus = body.status ?? translation.status
  if (body.status === 'PUBLISHED' && translation.clientSite.publishToWeb === false)
    throw createError({ statusCode: 403, message: t('common.errors.publicationChannelDisabled')! })

  if (nextStatus === 'PUBLISHED' && (!nextTitle || !nextContent))
    throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const slug =
    translation.slug ??
    (await dedupeTranslationSlug(
      db,
      articleSlug(nextTitle!),
      user.clientSiteId!,
      translation.language,
      translation.articleId,
    ))

  const updated = await db.$transaction(async (tx) => {
    const changed = await tx.articleTranslation.updateMany({
      where: {
        id: translation.id,
        clientSiteId: user.clientSiteId!,
        status: translation.status,
        updatedAt: body.expectedUpdatedAt === null ? null : new Date(body.expectedUpdatedAt!),
      },
      data: {
        // updateMany does not advance @updatedAt in this ORM; CAS needs a fresh, monotonic token.
        updatedAt: nextTranslationVersion(body.expectedUpdatedAt === null ? null : new Date(body.expectedUpdatedAt!)),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.excerpt !== undefined ? { excerpt: body.excerpt } : {}),
        ...(body.content !== undefined ? { content: sanitizeHtml(body.content) } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.title !== undefined || body.excerpt !== undefined || body.content !== undefined
          ? { source: 'HUMAN' as const }
          : {}),
        slug,
        error: null,
      },
    })
    if (changed.count !== 1)
      throw createError({
        statusCode: 409,
        message: t('articles.editor.history.conflict')!,
        data: { code: 'ARTICLE_EDIT_CONFLICT' },
      })
    return tx.articleTranslation.findUniqueOrThrow({
      where: { id: translation.id },
      select: translationSelect,
    })
  })

  await invalidateFeed(user.clientSiteId!)

  await syncArticleMediaUsages(prisma, {
    clientSiteId: user.clientSiteId!,
    articleId: translation.articleId,
    articleTranslationId: updated.id,
    language: updated.language,
    content: updated.content,
  })

  try {
    await logAction({
      action: body.status === 'PUBLISHED' ? 'TRANSLATION_PUBLISHED' : 'TRANSLATION_UPDATED',
      userId: user.id,
      clientSiteId: user.clientSiteId!,
      ip: getIp(event),
      metadata: { translationId: updated.id, articleId: translation.articleId, language: updated.language },
    })
  } catch (error) {
    await reportCaughtError('Translation audit failed after persistence', error, {
      translationId: updated.id,
      clientSiteId: user.clientSiteId!,
    })
  }

  if (updated.status === 'PUBLISHED')
    await announceArticle(translation.articleId, user.clientSiteId!).catch((error: unknown) =>
      reportCaughtError('Translation announcement failed after persistence', error, {
        translationId: updated.id,
        clientSiteId: user.clientSiteId!,
      }),
    )

  return { translation: updated }
})

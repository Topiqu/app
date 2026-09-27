import { z } from 'zod'
import { LANGUAGE_OPTIONS } from '~~/shared/siteSchemas'
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

  const { language } = await readValidatedBody(event, z.object({ language: z.nativeEnum(Language).optional() }).parse)

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
  const targetLang = language ?? LANGUAGE_OPTIONS.find((candidate) => candidate !== sourceLang)
  if (!targetLang || targetLang === sourceLang)
    throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const { usage, slug: baseSlug, ...translated } = await generateTranslation(article, targetLang)

  await recordAiUsage(
    user.clientSiteId,
    usage.totalTokens || 0,
    'TRANSLATE_ARTICLE',
    { articleId: article.id, targetLang, usage },
    event,
  )

  const slug = await dedupeTranslationSlug(db, baseSlug, user.clientSiteId, targetLang, article.id)

  const translation = await db.articleTranslation.upsert({
    where: { articleId_language: { articleId: article.id, language: targetLang } },
    create: {
      articleId: article.id,
      clientSiteId: user.clientSiteId,
      language: targetLang,
      slug,
      title: translated.title,
      excerpt: translated.excerpt,
      content: sanitizeHtml(translated.content),
      answer: translated.answer,
      keyTakeaways: translated.keyTakeaways,
      faq: translated.faq,
      status: 'READY',
      source: 'AI',
      model: aiModelId('translation'),
      usage: toDatabaseJson(usage),
      error: null,
      translatedAt: new Date(),
    },
    update: {
      slug,
      title: translated.title,
      excerpt: translated.excerpt,
      content: sanitizeHtml(translated.content),
      answer: translated.answer,
      keyTakeaways: translated.keyTakeaways,
      faq: translated.faq,
      status: 'READY',
      source: 'AI',
      model: aiModelId('translation'),
      usage: toDatabaseJson(usage),
      error: null,
      translatedAt: new Date(),
    },
  })

  await syncArticleMediaUsages(prisma, {
    clientSiteId: user.clientSiteId,
    articleId: article.id,
    articleTranslationId: translation.id,
    language: translation.language,
    content: translation.content,
  })

  await logAction({
    action: 'TRANSLATE_ARTICLE',
    userId: user.id,
    clientSiteId: user.clientSiteId,
    ip: getIp(event),
    metadata: { articleId: article.id, translationId: translation.id, targetLang },
  })

  return { translation }
})

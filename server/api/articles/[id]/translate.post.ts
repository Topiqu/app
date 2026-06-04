import { type ClientPlan, Language } from '@prisma/client'

const TRANSLATION_PLANS: ClientPlan[] = ['PRO', 'PREMIUM', 'CUSTOM']
const MIN_TRANSLATION_TOKENS = 500

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const id = getRouterParam(event, 'id')
  const user = (await getServerSession(event))?.user

  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })
  if (!user || !user.clientSiteId || user.role !== 'admin')
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  await ensureMinAccountAge(event, user.id)

  const { language } = await readValidatedBody(
    event,
    z.object({ language: z.nativeEnum(Language).optional() }).parse,
  )

  const db = await getEnhancedPrisma(user)

  const clientSite = await db.clientSite.findUnique({
    where: { id: user.clientSiteId },
    select: { enableAi: true, plan: true, language: true, tokenRemaining: true },
  })
  if (!clientSite) throw createError({ statusCode: 404, message: t('common.errors.clientNotFound')! })

  if (!clientSite.enableAi || !TRANSLATION_PLANS.includes(clientSite.plan))
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const sourceLang = clientSite.language
  const targetLang = language ?? (sourceLang === Language.cs ? Language.en : Language.cs)
  if (targetLang === sourceLang)
    throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  if (!clientSite.tokenRemaining || clientSite.tokenRemaining < MIN_TRANSLATION_TOKENS)
    throw createError({ statusCode: 402, message: 'Insufficient tokens' })

  const article = await db.article.findUnique({
    where: { id },
    select: { id: true, title: true, excerpt: true, content: true, status: true },
  })
  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

  const { usage, slug: baseSlug, ...translated } = await generateTranslation(article, targetLang)

  await consumeClientTokens(
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
      status: 'READY',
      source: 'AI',
      model: 'grok-4-1-fast',
      usage,
      error: null,
      translatedAt: new Date(),
    },
    update: {
      slug,
      title: translated.title,
      excerpt: translated.excerpt,
      content: sanitizeHtml(translated.content),
      status: 'READY',
      source: 'AI',
      model: 'grok-4-1-fast',
      usage,
      error: null,
      translatedAt: new Date(),
    },
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

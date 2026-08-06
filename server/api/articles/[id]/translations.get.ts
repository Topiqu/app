export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const { user, db } = await requireDb(event, { minRole: 'admin', clientSite: true })

  const article = await db.article.findFirst({
    where: { id, clientSiteId: user.clientSiteId! },
    select: { id: true },
  })
  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

  const clientSite = await db.clientSite.findUnique({
    where: { id: user.clientSiteId! },
    select: { language: true, translationMode: true, translationLanguages: true },
  })
  if (!clientSite) throw createError({ statusCode: 404, message: t('common.errors.clientNotFound')! })

  const targetLanguages = resolveTargetLanguages(clientSite)

  const translations = await db.articleTranslation.findMany({
    where: { articleId: id, clientSiteId: user.clientSiteId! },
    orderBy: { language: 'asc' },
    select: {
      id: true,
      language: true,
      slug: true,
      title: true,
      excerpt: true,
      content: true,
      status: true,
      source: true,
      model: true,
      error: true,
      translatedAt: true,
      updatedAt: true,
    },
  })

  return { translations, targetLanguages, translationMode: clientSite.translationMode }
})

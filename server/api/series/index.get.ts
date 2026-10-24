export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')
  const db = await getEnhancedPrisma(user)

  const clientSiteId = user.clientSiteId
  if (!clientSiteId) {
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })
  }

  const series = await db.articleSeries.findMany({
    where: { clientSiteId, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      createdByAi: true,
      updatedAt: true,
      articles: {
        where: { deletedAt: null },
        select: { id: true, title: true, slug: true, language: true, status: true, releaseAt: true, seriesOrder: true },
        orderBy: [{ seriesOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: { name: 'asc' },
  })

  const now = new Date()
  return series.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: s.description,
    createdByAi: s.createdByAi,
    updatedAt: s.updatedAt,
    articles: s.articles.map((article) => ({
      ...article,
      available: article.status === 'published' && (!article.releaseAt || article.releaseAt <= now),
    })),
  }))
})

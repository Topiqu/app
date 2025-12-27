export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  const db = await getEnhancedPrisma(user)

  if (!user) {
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  }

  const clientSiteId = user.clientSiteId
  if (!clientSiteId) {
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })
  }

  const series = await db.articleSeries.findMany({
    where: { clientSiteId },
    select: {
      id: true,
      name: true,
      slug: true,
      articles: {
        select: { id: true },
        orderBy: { seriesOrder: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  return series.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    articles: s.articles,
  }))
})

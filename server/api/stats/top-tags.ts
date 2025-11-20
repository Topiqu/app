export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  if (!user.clientSiteId) throw createError({ statusCode: 403, message: t('common.errors.missing')! })

  const { take, skip } = await getPagination(event)

  const tags = await prisma.tag.findMany({
    where: { clientSiteId: user.clientSiteId },
    select: {
      id: true,
      name: true,
      articles: { select: { article: { select: { views: true } } } },
    },
    skip,
    take,
    orderBy: { articles: { _count: 'desc' } },
  })

  return tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    views: tag.articles.reduce((sum, a) => sum + a.article.views, 0),
    articleCount: tag.articles.length,
  }))
})

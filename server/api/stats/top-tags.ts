export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })
  if (!user.clientSiteId) throw createError({ statusCode: 403, message: 'Uživatel není přiřazen k žádnému ClientSite' })

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

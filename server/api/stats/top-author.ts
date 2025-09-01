export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })
  if (!user.clientSiteId) throw createError({ statusCode: 403, message: 'Uživatel není přiřazen k žádnému ClientSite' })

  const topAuthor = await prisma.user.findFirst({
    where: { articles: { some: { status: 'published', clientSiteId: user.clientSiteId } } },
    orderBy: { articles: { _count: 'desc' } },
    select: {
      username: true,
      avatarUrl: true,
      articles: { where: { status: 'published', clientSiteId: user.clientSiteId } },
    },
  })

  return topAuthor
    ? { username: topAuthor.username, avatarUrl: topAuthor.avatarUrl, articleCount: topAuthor.articles.length }
    : null
})

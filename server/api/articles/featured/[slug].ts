export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const name = decodeURIComponent(getRouterParam(event, 'slug')!).trim()
  if (!name) throw createError({ statusCode: 400, message: 'Neplatný požadavek' })

  const db = await getEnhancedPrisma(user)
  const clientSite = await db.clientSite.findUnique({
    where: { name },
    select: { id: true },
  })

  if (!clientSite) throw createError({ statusCode: 404, message: 'Blog nenalezen' })

  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

  const articles = await db.article.findMany({
    where: {
      clientSiteId: clientSite.id,
      createdAt: { gte: twoWeeksAgo },
    },
    include: {
      tags: { include: { tag: true } },
      user: { select: { id: true, username: true, email: true, role: true, avatarUrl: true } },
      _count: { select: { comments: true, reactions: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  const sortedArticles = articles.sort((a, b) => {
    const aScore = (a._count?.reactions ?? 0) + (a._count?.comments ?? 0)
    const bScore = (b._count?.reactions ?? 0) + (b._count?.comments ?? 0)
    return bScore - aScore || b.createdAt.getTime() - a.createdAt.getTime()
  })

  const [featured, ...recommended] = sortedArticles.length ? sortedArticles.slice(0, 3) : sortedArticles

  return { featured, recommended }
})

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const username = decodeURIComponent(getRouterParam(event, 'id')!.trim())
  if (!username) throw createError({ statusCode: 400, message: 'Uživatelské jméno je povinné' })
  console.log(username)
  const { skip, take } = await getPagination(event)
  const query = getQuery(event)
  const { search = '', sort = 'createdAt:desc' } = query as { search?: string; sort?: string }

  const db = await getEnhancedPrisma(user)

  const author = await db.user.findUnique({
    where: { username },
    select: { id: true, username: true, avatarUrl: true, bio: true, clientSiteId: true },
  })
  if (!author) throw createError({ statusCode: 404, message: `Autor nenalezen: ${username}` })

  const [field, order] = (sort as string).split(':') as ['createdAt' | 'title', 'asc' | 'desc']

  const articles = await db.article.findMany({
    where: {
      userId: author.id,
      status:
        (user?.role === 'admin' && user?.clientSiteId == author.clientSiteId) || user?.role === 'superadmin'
          ? undefined
          : 'published',
      ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
    },
    take: take + 1,
    skip,
    orderBy: { [field]: order },
    include: {
      user: { select: { username: true } },
      tags: { include: { tag: true } },
      _count: { select: { reactions: true } },
    },
  })

  const hasMore = articles.length > take
  const items = hasMore ? articles.slice(0, take) : articles

  return {
    id: author.id,
    username: author.username,
    avatarUrl: author.avatarUrl,
    bio: author.bio,
    articles: items.map((a) => ({
      articleId: a.id,
      article: {
        ...a,
        likes: a._count.reactions,
        views: a.views,
      },
    })),
    hasMore,
  }
})

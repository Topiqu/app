export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  let username = getRouterParam(event, 'id')

  if (!username) {
    throw createError({ statusCode: 400, message: 'Uživatelské jméno je povinné' })
  }
  username = decodeURIComponent(username).trim()

  const db = await getEnhancedPrisma(user)

  const author = await db.user.findUnique({
    where: { username },
    select: { id: true, username: true, avatarUrl: true, bio: true },
  })

  if (!author) {
    throw createError({ statusCode: 404, message: `Autor nenalezen: ${username}` })
  }

  const articles = await db.article.findMany({
    where: {
      userId: author.id,
      OR: [{ status: 'published' }, ...(user?.role === 'admin' || user?.role === 'superadmin' ? [{}] : [])],
    },
    include: {
      user: { select: { username: true } },
      tags: { include: { tag: true } },
      _count: {
        select: {
          reactions: true,
          comments: { where: { deletedAt: null } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return {
    id: author.id,
    username: author.username,
    avatarUrl: author.avatarUrl,
    bio: author.bio,
    articles: articles.map((a) => ({
      articleId: a.id,
      article: {
        ...a,
        likes: a._count.reactions,
        views: a.views,
      },
    })),
  }
})

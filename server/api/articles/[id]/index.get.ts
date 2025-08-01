export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const slug = getRouterParam(event, 'id')
  if (!slug) throw createError({ statusCode: 400, message: 'Slug je povinný' })

  const sessionId = getCookie(event, 'anon_session')
  const db = await getEnhancedPrisma(user)

  const article = await db.article.findUnique({
    where: { slug },
    include: {
      user: { select: { username: true, id: true } },
      tags: { include: { tag: true } },
      reactions: true,
      _count: {
        select: {
          comments: { where: { deletedAt: null } },
          reactions: true,
        },
      },
    },
  })

  if (!article) throw createError({ statusCode: 404, message: 'Článek nenalezen' })

  if (article.status !== 'published' && user?.role !== 'admin')
    throw createError({ statusCode: 403, message: 'Nedostupné' })

  return {
    ...article,
    commentCount: article._count.comments,
    likes: article._count.reactions,
    likedByUser: user?.id
      ? article.reactions.some((r) => r.userId === user.id)
      : sessionId
        ? article.reactions.some((r) => r.sessionId === sessionId)
        : false,
  }
})

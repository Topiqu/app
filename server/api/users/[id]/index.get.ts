export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const { id } = getRouterParams(event)
  const db = await getEnhancedPrisma(user)
  const userData = await db.user.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          comments: true,
          followers: true,
          following: true,
        },
      },
      reactions: true,
    },
  })

  if (!userData) throw createError({ statusCode: 404, message: 'Uživatel nenalezen' })

  const likesCount = await db.commentReaction.count({
    where: { userId: id, type: 'LIKE' },
  })

  const dislikesCount = await db.commentReaction.count({
    where: { userId: id, type: 'DISLIKE' },
  })

  return {
    ...userData,
    likesCount,
    dislikesCount,
  }
})

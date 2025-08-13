export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const { id } = getRouterParams(event)
  if (user.id !== id && user.role !== 'superadmin')
    throw createError({ statusCode: 403, message: 'Nepovolený přístup' })

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
    id: userData.id,
    username: userData.username,
    email: userData.email,
    bio: userData.bio,
    avatarUrl: userData.avatarUrl,
    createdAt: userData.createdAt.toISOString(),
    lastLogin: userData.lastLogin ? userData.lastLogin.toISOString() : null,
    allowNotifs: userData.allowNotifs,
    role: userData.role,
    emailVerified: userData.emailVerified,
    theme: userData.theme,
    commentsCount: userData._count.comments,
    followers: userData._count.followers,
    following: userData._count.following,
    likesCount,
    dislikesCount,
  }
})

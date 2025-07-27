export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user)
    throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })

  const { id } = getRouterParams(event)
  if (user.id !== id && user.role !== 'superadmin')
    throw createError({ statusCode: 403, statusMessage: 'Nepovolený přístup' })

  const userData = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      bio: true,
      avatarUrl: true,
      lastLogin: true,
      comments: {
        select: {
          id: true,
          reactions: {
            select: { type: true },
          },
        },
      },
    },
  })

  if (!userData)
    throw createError({ statusCode: 404, statusMessage: 'Uživatel nenalezen' })

  const likesCount = userData.comments.reduce(
    (sum, comment) =>
      sum + comment.reactions.filter((r) => r.type === 'LIKE').length,
    0,
  )
  const dislikesCount = userData.comments.reduce(
    (sum, comment) =>
      sum + comment.reactions.filter((r) => r.type === 'DISLIKE').length,
    0,
  )

  return {
    id: userData.id,
    username: userData.username,
    email: userData.email,
    bio: userData.bio,
    avatarUrl: userData.avatarUrl,
    lastLogin: userData.lastLogin,
    commentsCount: userData.comments.length,
    likesCount,
    dislikesCount,
  }
})

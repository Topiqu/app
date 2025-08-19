export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const userData = await prisma.user.findUnique({
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
  return {
    username: userData.username,
    avatarUrl: userData.avatarUrl,
  }
})

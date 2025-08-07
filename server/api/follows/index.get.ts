export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID je povinné' })

  const db = await getEnhancedPrisma(user)
  const targetUser = await db.user.findUnique({
    where: { id },
    select: { id: true, clientSiteId: true },
  })

  if (!targetUser) throw createError({ statusCode: 404, message: 'Uživatel nenalezen' })

  const following = await db.follow.findMany({
    where: { followerId: id },
    include: {
      followed: {
        select: { id: true, username: true, email: true, role: true, avatarUrl: true, bio: true },
      },
    },
  })

  const followers = await db.follow.findMany({
    where: { followedId: id },
    include: {
      follower: {
        select: { id: true, username: true, email: true, role: true, avatarUrl: true, bio: true },
      },
    },
  })

  return {
    userId: targetUser.id,
    following: following.map((f) => f.followed),
    followers: followers.map((f) => f.follower),
  }
})

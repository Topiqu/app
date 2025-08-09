export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const db = await getEnhancedPrisma(user)
  const followers = await db.follow.findMany({
    where: { followedId: user.id },
    include: {
      follower: {
        select: { id: true, username: true, email: true, role: true, avatarUrl: true, bio: true },
      },
    },
  })

  return followers.map((f) => f.follower)
})

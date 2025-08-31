export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })
  const id = getRouterParam(event, 'id')
  const db = await getEnhancedPrisma(user)

  const follow = await db.follow.findFirst({
    where: { followerId: user.id, followedId: id },
  })

  if (!follow) throw createError({ statusCode: 404, message: 'Follow vztah nenalezen' })

  await db.follow.delete({
    where: { followerId_followedId: { followerId: user.id, followedId: id! } },
  })

  const followerCount = await db.follow.count({
    where: { followedId: id },
  })

  return { success: true, followerCount }
})

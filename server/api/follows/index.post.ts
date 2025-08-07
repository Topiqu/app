export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const body = await readValidatedBody(event, z.object({ followedId: z.string() }).parse)

  const db = await getEnhancedPrisma(user)
  const followedUser = await db.user.findFirst({
    where: { id: body.followedId },
  })

  if (!followedUser)
    throw createError({
      statusCode: 404,
      message: 'Uživatel nenalezen.',
    })

  if (user.id === body.followedId)
    throw createError({
      statusCode: 400,
      message: 'Nemůžete sledovat sám sebe.',
    })

  const existingFollow = await db.follow.findFirst({
    where: { followerId: user.id, followedId: body.followedId },
  })

  if (existingFollow)
    throw createError({
      statusCode: 409,
      message: 'Už tohoto uživatele sledujete.',
    })

  const follow = await db.follow.create({
    data: {
      followerId: user.id,
      followedId: body.followedId,
    },
  })

  await prisma.notification.create({
    data: {
      userId: body.followedId,
      message: `Uživatel ${user.name} vás začal sledovat!`,
      type: 'FOLLOW',
    },
  })

  return follow
})

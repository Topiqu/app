export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const body = await readValidatedBody(event, z.object({ followedId: z.string() }).parse)
  if (user.id === body.followedId)
    throw createError({ statusCode: 400, message: t('common.errors.cannotFollowYourself')! })

  const db = await getEnhancedPrisma(user)

  const followedUser = await db.user.findFirst({ where: { id: body.followedId } })
  if (!followedUser) throw createError({ statusCode: 404, message: t('common.errors.userNotFound')! })

  const existingFollow = await db.follow.findFirst({ where: { followerId: user.id, followedId: body.followedId } })
  if (existingFollow) throw createError({ statusCode: 409, message: t('common.errors.alreadyFollowingUser')! })

  const follow = await db.follow.create({ data: { followerId: user.id, followedId: body.followedId } })

  await prisma.notification.create({
    data: {
      userId: body.followedId,
      message: t('notifications.newFollower', { user: user.name || 'Anonymous' })!,
      type: 'FOLLOW',
    },
  })

  const followerCount = await db.follow.count({
    where: { followedId: body.followedId },
  })

  return { follow, followerCount }
})

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

  // A missing i18n key returns undefined in production. Prisma then treats the property as
  // omitted and rejects the required Notification.message field, even though TypeScript's `!`
  // makes the call look safe at compile time.
  const message =
    t('common.notifications.newFollower', { user: user.name || 'Anonymous' }) ||
    `${user.name || 'Anonymous'} started following you.`

  await prisma.notification.create({
    data: {
      userId: body.followedId,
      message,
      type: 'FOLLOW',
    },
  })

  const followerCount = await db.follow.count({
    where: { followedId: body.followedId },
  })

  return { follow, followerCount }
})

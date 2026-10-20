export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const { id } = getRouterParams(event)
  if (user.id !== id && user.role !== 'superadmin')
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })
  const db = await getEnhancedPrisma(user)

  const userData = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      avatarUrl: true,
      role: true,
      language: true,
      theme: true,
      bio: true,
      clientSiteId: true,
      emailVerified: true,
      createdAt: true,
      _count: { select: { comments: true, followers: true, following: true } },
    },
  })

  if (!userData) throw createError({ statusCode: 404, message: t('common.errors.userNotFound')! })

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

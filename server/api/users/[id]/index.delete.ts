export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const userId = getRouterParam(event, 'id')
  if (!userId) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  // Deleting your own account goes through `POST /api/users/deletion`, which proves identity and can be undone.
  if (user.id === userId || user.role !== 'superadmin')
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const db = await getEnhancedPrisma(user)
  const targetUser = await db.user.findFirst({ where: { id: userId, deletedAt: null }, select: { clientSiteId: true } })
  if (!targetUser) throw createError({ statusCode: 404, message: t('common.errors.userNotFound')! })

  await db.user.update({ where: { id: userId }, data: { deletedAt: new Date() } })
  await db.session.deleteMany({ where: { userId } })

  await invalidateAuthor(userId)
  await logAction({
    action: 'USER_DEACTIVATED',
    userId: user.id,
    clientSiteId: targetUser.clientSiteId,
    ip: getIp(event),
    metadata: { targetUserId: userId },
  })
  return { message: t('common.messages.successGeneral')! }
})

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const userId = getRouterParam(event, 'id')
  if (!userId) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const self = user.id === userId
  if (!self && user.role !== 'superadmin') throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const db = await getEnhancedPrisma(user)
  const targetUser = await db.user.findFirst({ where: { id: userId, deletedAt: null }, select: { clientSiteId: true } })
  if (!targetUser) throw createError({ statusCode: 404, message: t('common.errors.userNotFound')! })

  if (self) {
    // Ownership cannot be transferred, so leaving would strand a live, possibly billed blog without an owner.
    const owned = await prisma.tenantMembership.count({
      where: { userId, role: 'OWNER', deletedAt: null, clientSite: { deletedAt: null } },
    })
    if (owned) throw createError({ statusCode: 409, message: t('common.errors.ownerCannotDeactivate')! })
  }

  await db.user.update({ where: { id: userId }, data: { deletedAt: new Date() } })
  await db.session.updateMany({ where: { userId, revoked: false }, data: { revoked: true } })

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

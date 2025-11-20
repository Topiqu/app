export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const db = await getEnhancedPrisma(user)
  const sessionId = getRouterParam(event, 'sessionId')
  if (!sessionId) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const session = await db.session.findUnique({
    where: { id: sessionId, userId: user.id },
  })
  if (!session) throw createError({ statusCode: 404, message: t('common.errors.sessionNotFound')! })

  if (session.revoked) throw createError({ statusCode: 400, message: t('common.errors.sessionAlreadyRevoked')! })

  const ip = getIp(event)
  await db.session.update({
    where: { id: sessionId },
    data: { revoked: true },
  })

  await logAction({
    action: 'SESSION_REVOKE',
    userId: user.id,
    ip,
    metadata: { sessionId },
  })

  return { success: true }
})

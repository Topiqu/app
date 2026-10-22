export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await requireUser(event)
  requireSameAuthOrigin(event)
  if (!user.sessionId) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  if (!(await consumeRateLimit(`session-revoke:${user.id}`, 20, 60)))
    throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })

  const db = await getEnhancedPrisma(user)
  const { count } = await db.session.deleteMany({ where: { userId: user.id, id: { not: user.sessionId } } })

  try {
    await logAction({
      action: 'SESSIONS_REVOKE_OTHERS',
      userId: user.id,
      ip: getIp(event),
      metadata: { count },
    })
  } catch (error) {
    await reportCaughtError('Session revocation audit failed', error, { userId: user.id })
  }

  return { success: true, count }
})

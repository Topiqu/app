export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await requireUser(event)
  requireSameAuthOrigin(event)

  if (!(await consumeRateLimit(`session-revoke:${user.id}`, 20, 60)))
    throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })

  const sessionId = getRouterParam(event, 'sessionId')
  if (!sessionId) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const db = await getEnhancedPrisma(user)
  const { count } = await db.session.deleteMany({ where: { id: sessionId, userId: user.id } })
  if (!count) throw createError({ statusCode: 404, message: t('common.errors.sessionNotFound')! })

  try {
    await logAction({
      action: 'SESSION_REVOKE',
      userId: user.id,
      ip: getIp(event),
      metadata: { sessionId },
    })
  } catch (error) {
    await reportCaughtError('Session revocation audit failed', error, { userId: user.id })
  }

  return { success: true }
})

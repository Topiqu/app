export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await requireUser(event)

  const sessionId = getRouterParam(event, 'sessionId')
  if (!sessionId) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const db = await getEnhancedPrisma(user)
  const { count } = await db.session.deleteMany({ where: { id: sessionId, userId: user.id } })
  if (!count) throw createError({ statusCode: 404, message: t('common.errors.sessionNotFound')! })

  await logAction({
    action: 'SESSION_REVOKE',
    userId: user.id,
    ip: getIp(event),
    metadata: { sessionId },
  })

  return { success: true }
})

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  if (!(await consumeRateLimit(`user-export:${user.id}`, 5, 3600))) throw createError({ statusCode: 429 })

  const db = await getEnhancedPrisma(user)
  const account = await db.user.findUnique({ where: { id: user.id }, select: USER_EXPORT_ACCOUNT_SELECT })
  if (!account) throw createError({ statusCode: 404, message: t('common.errors.userNotFound')! })

  await logAction({ action: 'USER_DATA_EXPORT', userId: user.id, ip: getIp(event) })

  setResponseHeaders(event, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': 'attachment; filename="topiqu-account-export.json"',
    'Cache-Control': 'private, no-store',
  })
  return sendStream(event, userExportStream(db, account))
})

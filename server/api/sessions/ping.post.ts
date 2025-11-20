export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  if (!user.sessionId) throw createError({ statusCode: 401, message: t('common.errors.missingSessionId')! })

  const db = await getEnhancedPrisma(user)
  const session = await db.session.findFirst({
    where: { id: user.sessionId, userId: user.id },
  })

  if (!session || session.revoked) {
    throw createError({ statusCode: 401, message: t('common.errors.sessionInvalidOrRevoked')! })
  }

  await db.session.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  })

  return { ok: true }
})

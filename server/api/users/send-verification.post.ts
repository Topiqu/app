export default defineEventHandler(async (e) => {
  const { translate: t } = await useServerI18n(e)
  const user = await getSessionUser(e)
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const current = await prisma.user.findFirst({ where: { id: user.id, deletedAt: null }, select: { email: true } })
  if (!current) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  if (await allowEmailVerificationRequest(e, current.email, 'issue'))
    await issueEmailVerification(e, current.email, user.id)
  return { success: true, message: t('common.auth.verificationRequested')! }
})

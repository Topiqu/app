export default defineEventHandler(async (e) => {
  const { translate: t } = await useServerI18n(e)
  const body = await readBody(e)
  if (!body?.code)
    throw createError({
      statusCode: 400,
      message: t('common.errors.missing')!,
    })

  const { code } = body

  const verification = await prisma.verificationCode.findFirst({
    where: { code, expiresAt: { gt: new Date() } },
    include: { user: true },
  })

  if (!verification)
    throw createError({
      statusCode: 400,
      message: t('common.errors.invalidRequest')!,
    })

  await prisma.user.update({
    where: { id: verification.userId },
    data: { emailVerified: true, verification: { delete: true } },
  })

  return { success: true }
})

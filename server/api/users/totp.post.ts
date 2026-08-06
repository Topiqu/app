import argon from 'argon2'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { email, password } = await readBody(event)
  if (!email || !password) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, password: true, totpSecret: true, emailVerified: true },
  })
  if (!user || !user.password || !(await argon.verify(user.password, password)))
    throw createError({ statusCode: 401, message: t('common.errors.invalidCredentials')! })

  if (!user.emailVerified)
    throw createError({
      statusCode: 403,
      message: t('common.errors.emailNotVerified')!,
      data: { code: 'email_not_verified' },
    })

  const requiresTotp = !!user.totpSecret
  return {
    id: user.id,
    requiresTotp,
    challenge: requiresTotp ? signTotpChallenge(user.id) : null,
  }
})

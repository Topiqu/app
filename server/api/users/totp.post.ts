import argon from 'argon2'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const body = await readBody(event)
  const email = typeof body.email === 'string' ? normalizeLoginEmail(body.email) : ''
  const password = body.password
  if (!email || !password) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const limit = await checkLoginRateLimit(event.node.req, email, 'preflight')
  if (!limit.allowed) {
    await logLoginFailure(event.node.req, email, 'rate_limited', 'preflight')
    throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
    select: { id: true, password: true, totpSecret: true, emailVerified: true },
  })
  const failure = credentialFailure(user, !!user?.password && (await argon.verify(user.password, password)))
  if (failure) {
    await logLoginFailure(event.node.req, email, failure, 'preflight')
    if (failure !== 'email_unverified')
      throw createError({ statusCode: 401, message: t('common.errors.invalidCredentials')! })
    throw createError({
      statusCode: 403,
      message: t('common.errors.emailNotVerified')!,
      data: { code: 'email_not_verified' },
    })
  }
  if (!user) throw new Error('Credential decision invariant failed')

  const requiresTotp = !!user.totpSecret
  return {
    id: user.id,
    requiresTotp,
    challenge: requiresTotp ? signTotpChallenge(user.id) : null,
  }
})

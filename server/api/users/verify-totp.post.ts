import { authenticator } from 'otplib'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { challenge, token } = await readBody(event)
  if (!challenge || !token) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const { userId } = verifyTotpChallenge(challenge)

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true },
  })
  if (!user?.totpSecret) throw createError({ statusCode: 401, message: t('common.errors.invalidCredentials')! })

  const isValid = authenticator.verify({
    token: String(token).replace(/\s/g, ''),
    secret: user.totpSecret,
  })
  return { isValid }
})

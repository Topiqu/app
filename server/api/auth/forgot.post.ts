import { randomBytes } from 'crypto'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { email } = await readBody(event)
  if (!email) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw createError({ statusCode: 404, message: t('common.errors.userNotFound')! })

  const code = randomBytes(4).toString('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await prisma.verificationCode.upsert({
    where: { userId: user.id },
    update: { code, expiresAt },
    create: { code, expiresAt, userId: user.id },
  })

  await sendEmail({
    event,
    to: user.email,
    template: 'verificationCode',
    data: {
      userName: user.username,
      verificationCode: code,
      actionType: t('common.auth.resetPassword')!,
      logoUrl: 'https://cdn.topiqu.com/app-logo.png',
      // verificationUrl: `${useRuntimeConfig().public.baseUrl}/verify?code=${code}`,
      unsubscribeUrl: `${useRuntimeConfig().public.baseUrl}/unsubscribe?email=${user.email}`,
    },
  })

  return { message: t('common.auth.verificationCodeSent')! }
})

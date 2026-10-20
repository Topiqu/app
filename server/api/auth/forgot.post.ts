import { z } from 'zod'
import { randomBytes } from 'crypto'
import { passwordResetHash, passwordResetIdentifier } from '~~/server/utils/passwordReset'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { email } = await readValidatedBody(
    event,
    z.object({ email: z.email().transform((value) => value.trim().toLowerCase()) }).parse,
  )
  const accepted = { message: t('common.auth.verificationCodeSent')! }
  if (!(await consumeRateLimit(`forgot:ip:${ipKey(event)}`, 10, 900)))
    throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })
  if (!(await consumeRateLimit(`forgot:account:${passwordResetHash(email)}`, 1, 60))) return accepted

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
    select: { id: true, username: true, email: true },
  })
  if (!user) return accepted

  const code = randomBytes(4).toString('hex')
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  await prisma.$transaction(async (tx) => {
    await tx.verification.deleteMany({ where: { identifier: passwordResetIdentifier(user.id) } })
    await tx.verification.create({
      data: { identifier: passwordResetIdentifier(user.id), value: passwordResetHash(code), expiresAt },
    })
  })

  await sendEmail({
    event,
    to: user.email,
    template: 'verificationCode',
    data: {
      userName: user.username,
      verificationCode: code,
      expirationKey: 'resetExpiration',
      actionType: t('common.auth.resetPassword')!,
      logoUrl: 'https://cdn.topiqu.com/app-logo.png',
      // verificationUrl: `${useRuntimeConfig().public.baseUrl}/verify?code=${code}`,
    },
  })

  return accepted
})

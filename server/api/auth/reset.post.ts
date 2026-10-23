import { z } from 'zod'

const schema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  code: z.string().regex(/^[a-f0-9]{8}$/i),
  password: z.string().min(8).max(124),
})

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { email, code, password } = await readValidatedBody(event, schema.parse)
  const limits = await Promise.all([
    consumeRateLimit(`reset:ip:${ipKey(event)}`, 30, 900),
    consumeRateLimit(`reset:account:${passwordResetHash(email)}`, 8, 900),
  ])
  if (limits.includes(false)) throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
    select: { id: true, clientSiteId: true },
  })
  if (!user) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.verification.deleteMany({
      where: {
        identifier: passwordResetIdentifier(user.id),
        value: passwordResetHash(code.toLowerCase()),
        expiresAt: { gt: new Date() },
      },
    })
    if (consumed.count !== 1) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
    await tx.user.update({ where: { id: user.id }, data: { password } })
    await tx.verification.deleteMany({ where: { identifier: passwordResetIdentifier(user.id) } })
    await tx.session.deleteMany({ where: { userId: user.id } })
    await logAction({
      action: 'PASSWORD_CHANGE',
      userId: user.id,
      clientSiteId: user.clientSiteId,
      ip: getIp(event),
      metadata: { method: 'password_reset', sessionsRevoked: true },
      tx,
    })
  })

  return { message: t('common.messages.successGeneral')! }
})

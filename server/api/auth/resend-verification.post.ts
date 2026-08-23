import { randomBytes } from 'crypto'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { email } = await readBody(event)

  if (!email || typeof email !== 'string') throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: {
      id: true,
      email: true,
      username: true,
      emailVerified: true,
      verification: { select: { createdAt: true } },
    },
  })

  if (shouldIssueVerificationCode(user)) {
    const code = randomBytes(4).toString('hex')
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS)

    await prisma.verificationCode.deleteMany({ where: { userId: user!.id } })
    await prisma.verificationCode.create({ data: { code, userId: user!.id, expiresAt } })

    await sendEmail({
      event,
      to: user!.email,
      template: 'verificationCode',
      data: {
        verificationCode: code,
        userName: user!.username,
        actionType: '{t:verificationCode.actions.emailVerification}',
      },
    })
  }

  return { success: true, message: t('common.auth.verificationCodeSent')! }
})

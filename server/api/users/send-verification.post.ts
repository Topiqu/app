import { randomBytes } from 'crypto'

export default defineEventHandler(async (e) => {
  const { translate: t } = await useServerI18n(e)
  const user = (await getServerSession(e))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const { emailVerified } =
    (await prisma.user.findUnique({ where: { id: user.id }, select: { emailVerified: true } })) ?? {}
  if (emailVerified) throw createError({ statusCode: 400, message: t('common.errors.alreadyExists')! })

  const code = randomBytes(4).toString('hex')
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await prisma.verificationCode.deleteMany({ where: { userId: user.id } })
  await prisma.verificationCode.create({ data: { code, userId: user.id, expiresAt: expires } })

  await sendEmail({
    to: user.email,
    template: 'verificationCode',
    data: { verificationCode: code },
  })

  return { success: true, message: t('common.auth.verificationCodeSent')! }
})

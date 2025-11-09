import { randomBytes } from 'crypto'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const body = await readValidatedBody(event, signInSchema.parse)
  const { username, email, password } = body

  const exists = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  })
  if (exists)
    throw createError({
      statusCode: 400,
      message: exists.username === username ? t('common.errors.alreadyExists')! : t('common.errors.alreadyExists')!,
    })

  const code = randomBytes(4).toString('hex')
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const user = await saveUserWithLogging(event, {
    username: username!,
    email,
    password,
    role: 'reader',
    emailVerified: false,
    verification: { create: { code, expiresAt: expires } },
  })

  await sendEmail({
    event,
    to: email,
    template: 'verificationCode',
    data: {
      userName: username!,
      verificationCode: code,
      actionType: t('common.auth.register')!,
      // verificationUrl: `${useRuntimeConfig().public.baseUrl}/verify?code=${code}`,
      logoUrl: 'https://via.placeholder.com/150x50',
      unsubscribeUrl: `${useRuntimeConfig().public.baseUrl}/unsubscribe?email=${email}`,
    },
  })

  return user
})

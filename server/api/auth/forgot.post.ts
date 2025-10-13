import { randomBytes } from 'crypto'

import { sendEmail } from '~/../emails/sendEmail'

export default defineEventHandler(async (event) => {
  const { email } = await readBody(event)
  if (!email) throw createError({ statusCode: 400, message: 'E-mail je povinný' })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw createError({ statusCode: 404, message: 'Uživatel nenalezen' })

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
      actionType: 'obnovy hesla',
      logoUrl: 'https://via.placeholder.com/150x50',
      // verificationUrl: `${useRuntimeConfig().public.baseUrl}/verify?code=${code}`,
      unsubscribeUrl: `${useRuntimeConfig().public.baseUrl}/unsubscribe?email=${user.email}`,
    },
  })

  return { message: 'Kód odeslán' }
})

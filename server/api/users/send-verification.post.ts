import { randomBytes } from 'crypto'

import { sendEmail } from '~/../emails/sendEmail'

export default defineEventHandler(async (e) => {
  const user = (await getServerSession(e))?.user
  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Neautorizovaný přístup',
    })
  }
  const userDb = await prisma.user.findUnique({ where: { id: user.id }, select: { username: true } })
  const emailVerified = await prisma.user.findUnique({
    where: { id: user.id },
    select: { emailVerified: true },
  })
  if (emailVerified?.emailVerified) {
    throw createError({
      statusCode: 400,
      message: 'E-mail je již ověřen',
    })
  }

  const code = randomBytes(4).toString('hex')
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await prisma.verificationCode.deleteMany({
    where: { userId: user.id },
  })

  await prisma.verificationCode.create({
    data: {
      code,
      userId: user.id,
      expiresAt: expires,
    },
  })

  await sendEmail({
    to: user.email,
    subject: 'Ověření e-mailu',
    text: `Váš ověřovací kód: ${code}. Kód je platný 24 hodin.`,
    template: 'verification-code',
    data: {
      userName: userDb!.username,
      verificationCode: code,
      actionType: 'ověření e-mailu',
      logoUrl: 'https://via.placeholder.com/150x50',
      // verificationUrl: `${useRuntimeConfig().public.baseUrl}/verify?code=${code}`,
      unsubscribeUrl: `${useRuntimeConfig().public.baseUrl}/unsubscribe?email=${user.email}`,
    },
  })

  return { success: true, message: 'Ověřovací kód byl odeslán na váš e-mail' }
})

import { randomBytes } from 'crypto'
export default defineEventHandler(async (e) => {
  const user = (await getServerSession(e))?.user
  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Neautorizovaný přístup',
    })
  }
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

  const t = useNodeMailer()
  await t.sendMail({
    from: useRuntimeConfig().from,
    to: user.email,
    subject: 'Ověření e-mailu',
    text: `Váš ověřovací kód: ${code}`,
    html: `<p>Váš ověřovací kód: <b>${code}</b></p><p>Kód je platný 24 hodin.</p>`,
  })

  return { success: true, message: 'Ověřovací kód byl odeslán na váš e-mail' }
})

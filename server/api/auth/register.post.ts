import argon from 'argon2'
import { randomBytes } from 'crypto'

export default defineEventHandler(async (e) => {
  const body = await readValidatedBody(e, signInSchema.parse)
  const { username, email, password } = body

  const exists = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  })
  if (exists)
    throw createError({
      statusCode: 400,
      message: exists.username === username ? 'Uživatelské jméno je zabrané' : 'Email už existuje',
    })

  const code = randomBytes(4).toString('hex')
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const hash = await argon.hash(password)

  const user = await prisma.user.create({
    data: {
      username: username!,
      email,
      password: hash,
      role: 'reader',
      emailVerified: false,
      verification: { create: { code, expiresAt: expires } },
    },
    select: { id: true, username: true, email: true },
  })

  const t = useNodeMailer()
  await t.sendMail({
    from: useRuntimeConfig().from,
    to: email,
    subject: 'Ověření registrace',
    text: `Váš ověřovací kód: ${code}`,
    html: `<p>Váš ověřovací kód: <b>${code}</b></p><p>Kód je platný 24 hodin.</p>`,
  })

  return user
})

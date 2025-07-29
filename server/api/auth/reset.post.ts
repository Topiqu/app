import argon from 'argon2'

export default defineEventHandler(async (event) => {
  const { email, code, password } = await readBody(event)
  if (!email || !code || !password) throw createError({ statusCode: 400, message: 'Všechna pole jsou povinná' })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw createError({ statusCode: 404, message: 'Uživatel nenalezen' })

  const verification = await prisma.verificationCode.findUnique({ where: { userId: user.id } })
  if (!verification || verification.code !== code || verification.expiresAt < new Date()) {
    throw createError({ statusCode: 400, message: 'Neplatný nebo expirovaný kód' })
  }

  const hashedPassword = await argon.hash(password)
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  })

  await prisma.verificationCode.delete({ where: { userId: user.id } })

  return { message: 'Heslo změněno' }
})

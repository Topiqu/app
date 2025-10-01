export default defineEventHandler(async (event) => {
  const { email, code, password } = await readBody(event)
  if (!email || !code || !password) throw createError({ statusCode: 400, message: 'Všechna pole jsou povinná' })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw createError({ statusCode: 404, message: 'Uživatel nenalezen' })

  const verification = await prisma.verificationCode.findUnique({ where: { userId: user.id } })
  if (!verification || verification.code !== code || verification.expiresAt < new Date()) {
    throw createError({ statusCode: 400, message: 'Neplatný nebo expirovaný kód' })
  }

  await saveUserWithLogging(
    event,
    {
      id: user.id,
      password,
    },
    true,
  )

  await prisma.verificationCode.delete({ where: { userId: user.id } })

  return { message: 'Heslo změněno' }
})

import argon from 'argon2-browser'

export default defineEventHandler(async (event) => {
  const { email, password } = await readBody(event)
  if (!email || !password) throw createError({ statusCode: 400, message: 'Email a heslo jsou povinné' })

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, password: true, totpSecret: true },
  })
  if (!user) throw createError({ statusCode: 401, message: 'Neplatné přihlašovací údaje' })

  const isPasswordValid = await argon.verify({ pass: user.password!, encoded: password })
  if (!isPasswordValid) throw createError({ statusCode: 401, message: 'Neplatné přihlašovací údaje' })

  return { id: user.id, totpSecret: user.totpSecret }
})

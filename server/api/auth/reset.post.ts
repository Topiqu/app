import { zxcvbn } from '@zxcvbn-ts/core'

export default defineEventHandler(async (event) => {
  const { email, code, password } = await readBody(event)
  if (!email || !code || !password) throw createError({ statusCode: 400, message: 'Všechna pole jsou povinná' })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw createError({ statusCode: 404, message: 'Uživatel nenalezen' })

  const verification = await prisma.verificationCode.findUnique({ where: { userId: user.id } })
  if (!verification || verification.code !== code || verification.expiresAt < new Date()) {
    throw createError({ statusCode: 400, message: 'Neplatný nebo expirovaný kód' })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { password },
  })
  const ip = getIp(event)
  const strength = password ? zxcvbn(password).score : null
  await logAction({
    action: 'USER_UPDATE',
    userId: user.id,
    clientSiteId: user.clientSiteId ?? null,
    ip,
    metadata: { username: user.username, email: user.email },
  })

  if (strength !== null) {
    await logAction({
      action: 'PASSWORD_CHANGE',
      userId: user.id,
      clientSiteId: user.clientSiteId,
      ip,
      metadata: { passwordStrength: strength },
    })
  }

  await prisma.verificationCode.delete({ where: { userId: user.id } })

  return { message: 'Heslo změněno' }
})

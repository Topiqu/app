export default defineEventHandler(async (e) => {
  const body = await readBody(e)
  if (!body || !body?.code)
    throw createError({
      statusCode: 400,
      message: 'Neplatný nebo chybějící kód',
    })
  const { code } = body

  const verification = await prisma.verificationCode.findFirst({
    where: { code, expiresAt: { gt: new Date() } },
    include: { user: true },
  })
  if (!verification)
    throw createError({
      statusCode: 400,
      message: 'Neplatný nebo expirovaný kód',
    })

  await prisma.user.update({
    where: { id: verification.userId },
    data: { emailVerified: true, verification: { delete: true } },
  })

  return { success: true }
})

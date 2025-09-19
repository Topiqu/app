export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Neautorizováno' })
  }

  if (!user.sessionId) {
    throw createError({ statusCode: 401, message: 'Chybí sessionId' })
  }

  const db = await getEnhancedPrisma(user)
  const session = await db.session.findFirst({
    where: { id: user.sessionId, userId: user.id },
  })

  if (!session || session.revoked) {
    throw createError({
      statusCode: 401,
      message: 'Relace byla zrušena nebo neexistuje',
    })
  }

  await db.session.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  })

  return { ok: true }
})

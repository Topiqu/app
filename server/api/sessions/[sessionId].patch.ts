export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const db = await getEnhancedPrisma(user)
  const sessionId = getRouterParam(event, 'sessionId')
  if (!sessionId) throw createError({ statusCode: 400, message: 'ID relace nenalezeno' })

  const session = await db.session.findUnique({
    where: { id: sessionId, userId: user.id },
  })
  if (!session) throw createError({ statusCode: 404, message: 'Relace nenalezena' })

  if (session.revoked) throw createError({ statusCode: 400, message: 'Relace již byla zrušena' })

  const ip = getIp(event)
  await db.session.update({
    where: { id: sessionId },
    data: { revoked: true },
  })

  await logAction({
    action: 'SESSION_REVOKE',
    userId: user.id,
    ip,
    metadata: { sessionId },
  })

  return { success: true }
})

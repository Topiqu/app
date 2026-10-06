export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = await getEnhancedPrisma(user)
  await db.session.update({ where: { id: user.sessionId }, data: { lastUsedAt: new Date() } })
  return { ok: true }
})

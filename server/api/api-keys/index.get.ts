export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'API_KEY_CONTROL')
  const db = await getEnhancedPrisma(user)
  const keys = await db.apiKey.findMany({
    where: { clientSiteId: user.clientSiteId, revokedAt: null, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: API_KEY_VIEW,
  })
  return { keys }
})

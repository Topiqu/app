export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'API_KEY_CONTROL')
  const id = getRouterParam(event, 'id')
  const db = await getEnhancedPrisma(user)
  const revoked = id
    ? await db.apiKey.updateMany({
        where: { id, clientSiteId: user.clientSiteId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
    : { count: 0 }
  if (!revoked.count) throw createError({ statusCode: 404, message: 'API key not found' })

  await logAction({
    action: 'API_KEY_REVOKED',
    userId: user.id,
    clientSiteId: user.clientSiteId,
    ip: getIp(event),
    metadata: { apiKeyId: id },
  })
  return { success: true }
})

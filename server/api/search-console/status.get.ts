export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { role: ['admin', 'superadmin'], clientSite: true })
  if (user.role !== 'superadmin') await requireTenantScope(event, 'INTEGRATION_CONTROL', user.clientSiteId)
  const site = await db.clientSite.findUnique({
    where: { id: user.clientSiteId! },
    select: {
      plan: true,
      features: { where: { isActive: true, feature: { code: 'SEARCH_CONSOLE' } }, select: { id: true }, take: 1 },
    },
  })
  const connection = await db.searchConsoleConnection.findUnique({
    where: { clientSiteId: user.clientSiteId! },
    select: {
      googleEmail: true,
      propertyUrl: true,
      permissionLevel: true,
      status: true,
      lastSyncAt: true,
      lastErrorAt: true,
      lastError: true,
      autopilotEnabled: true,
      autopilotLastRunAt: true,
    },
  })
  const lastAction = connection
    ? await db.log.findFirst({
        where: {
          clientSiteId: user.clientSiteId!,
          action: {
            in: ['SEO_AUTOPILOT_CTR_OPTIMIZED', 'SEO_AUTOPILOT_CONTENT_REFRESHED', 'SEO_AUTOPILOT_ROLLED_BACK'],
          },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, action: true, createdAt: true, metadata: true },
      })
    : null
  const actionMetadata = lastAction?.metadata as { articleId?: unknown; query?: unknown } | null
  return {
    eligible: Boolean(site && ['PREMIUM', 'CUSTOM'].includes(site.plan) && site.features.length),
    connection,
    lastAction:
      lastAction && typeof actionMetadata?.articleId === 'string' && typeof actionMetadata.query === 'string'
        ? {
            id: lastAction.id,
            action: lastAction.action,
            createdAt: lastAction.createdAt,
            articleId: actionMetadata.articleId,
            query: actionMetadata.query,
          }
        : null,
  }
})

export default defineEventHandler(async (event) => {
  const { user, membership } = await requireTenantScope(event, 'TENANT_SETTINGS')
  const db = await getEnhancedPrisma(user)
  const site = await db.clientSite.findUnique({
    where: { id: membership.clientSiteId },
    select: { plan: true, domain: true, domainVerified: true },
  })
  return {
    widgets: await listSiteWidgets(db, membership.clientSiteId),
    allowed: WIDGET_KINDS.filter((kind) => site && widgetAllowed(kind, site)),
  }
})

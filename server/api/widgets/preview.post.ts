// The editor's live preview of a config not saved yet; same providers and cache as `/api/widgets/:id/data`.
export default defineEventHandler(async (event) => {
  const { user, membership } = await requireTenantScope(event, 'TENANT_SETTINGS')
  const widget = await readValidatedBody(event, widgetPreviewSchema.parse)
  if (!(await consumeRateLimit(`widget:preview:${membership.clientSiteId}`, 30, 60)))
    throw createError({ statusCode: 429, message: 'Too many previews' })

  const db = await getEnhancedPrisma(user)
  const site = await db.clientSite.findUnique({
    where: { id: membership.clientSiteId },
    select: { plan: true, domain: true, domainVerified: true },
  })
  if (!site || !widgetAllowed(widget.kind, site)) throw createError({ statusCode: 403 })

  return widget.kind === 'PRICE' ? widgetQuotes(widget.config) : widgetForecast(widget.config)
})

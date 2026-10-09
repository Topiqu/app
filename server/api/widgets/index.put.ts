// Replaces the tenant's whole set, so order is the array order and no reorder endpoint is needed.
// Plan limits apply at render (`publicWidgets`), so a downgraded tenant keeps its widgets and can still save.
export default defineEventHandler(async (event) => {
  const { user, membership } = await requireTenantScope(event, 'TENANT_SETTINGS')
  const { widgets } = await readValidatedBody(event, widgetsInputSchema.parse)
  const clientSiteId = membership.clientSiteId
  const db = await getEnhancedPrisma(user)

  // A CTA image is one of the tenant's own assets; its URL comes from the row, never from the body.
  const assetIds = widgets.flatMap((w) => (w.kind === 'CTA' && w.config.image ? [w.config.image.assetId] : []))
  const assets = assetIds.length
    ? await db.mediaAsset.findMany({
        where: { id: { in: assetIds }, clientSiteId, deletedAt: null },
        select: { id: true, url: true, deliveryUrl: true, defaultAltText: true },
      })
    : []
  for (const widget of widgets) {
    if (widget.kind !== 'CTA' || !widget.config.image) continue
    const asset = assets.find((a) => a.id === widget.config.image!.assetId)
    if (!asset) throw createError({ statusCode: 400, message: 'Unknown media asset' })
    widget.config.image = {
      assetId: asset.id,
      url: asset.deliveryUrl ?? asset.url,
      alt: widget.config.image.alt || asset.defaultAltText || '',
    }
  }

  const removed = await db.$transaction(async (tx) => {
    const kept = widgets.flatMap((widget) => (widget.id ? [widget.id] : []))
    const gone = await tx.siteWidget.findMany({
      where: { clientSiteId, deletedAt: null, id: { notIn: kept } },
      select: { id: true, kind: true },
    })
    if (gone.length)
      await tx.siteWidget.updateMany({
        where: { clientSiteId, id: { in: gone.map((w) => w.id) } },
        data: { deletedAt: new Date() },
      })
    for (const [position, { id, ...widget }] of widgets.entries()) {
      const data = { ...widget, position }
      // A body id only addresses this tenant's live rows; anything else becomes a new widget.
      const { count } = id
        ? await tx.siteWidget.updateMany({ where: { id, clientSiteId, deletedAt: null }, data })
        : { count: 0 }
      if (!count) await tx.siteWidget.create({ data: { ...data, clientSiteId } })
    }
    return gone
  })

  await logAction({
    action: 'SITE_WIDGETS_UPDATED',
    userId: user.id,
    clientSiteId,
    ip: getIp(event),
    metadata: { count: widgets.length, kinds: [...new Set(widgets.map((w) => w.kind))], removed },
  })
  return { widgets: await listSiteWidgets(db, clientSiteId) }
})

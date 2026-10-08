// Public: a reader's page loads live values for its price and weather widgets. Only stored configs are
// looked up, so this is never an open proxy to the providers.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const widget = id
    ? await prisma.siteWidget.findFirst({
        where: { id, active: true, deletedAt: null, kind: { in: ['PRICE', 'WEATHER'] } },
        select: { kind: true, config: true, clientSite: { select: { plan: true, domain: true, domainVerified: true, deletedAt: true } } },
      })
    : null
  if (!widget || widget.clientSite.deletedAt || !widgetAllowed(widget.kind, widget.clientSite))
    throw createError({ statusCode: 404 })

  setResponseHeader(event, 'cache-control', 'public, max-age=300')
  if (widget.kind === 'PRICE') return widgetQuotes(priceConfigSchema.parse(widget.config))
  return widgetForecast(weatherConfigSchema.parse(widget.config))
})

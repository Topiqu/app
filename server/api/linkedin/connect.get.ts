export default defineEventHandler(async (event) => {
  requireCentralAuth(event)
  const query = getQuery(event)
  if (query.appType === 'pages') throw createError({ statusCode: 403 })
  const result = await createIntegrationTicket(
    event,
    'linkedin',
    typeof query.clientSiteId === 'string' ? query.clientSiteId : undefined,
  )
  return sendRedirect(event, result.url)
})

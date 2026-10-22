export default defineEventHandler(async (event) => {
  requireCentralAuth(event)
  const result = await createIntegrationTicket(event, 'search-console')
  return sendRedirect(event, result.url)
})

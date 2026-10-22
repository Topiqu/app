import { z } from 'zod'

export default defineEventHandler(async (event) => {
  requireCentralAuth(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseHeader(event, 'referrer-policy', 'no-referrer')
  if (!(await consumeRateLimit(`integration-preview:${getIp(event)}`, 30, 600))) throw createError({ statusCode: 429 })
  const { request } = await getValidatedQuery(event, z.object({ request: integrationRequestSchema }).parse)
  const { data } = await loadIntegrationTicket(request)
  if (data.stateHash) throw createError({ statusCode: 409 })
  const user = await getSessionUser(event)
  return { host: new URL(data.origin).host, provider: data.provider, accountMatches: user?.id === data.actorId }
})

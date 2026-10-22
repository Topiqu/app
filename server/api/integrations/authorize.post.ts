import { z } from 'zod'

export default defineEventHandler(async (event) => {
  requireCentralAuth(event)
  requireSameAuthOrigin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  const { request, cancel } = await readValidatedBody(
    event,
    z
      .object({
        request: integrationRequestSchema,
        cancel: z.boolean().optional(),
      })
      .strict().parse,
  )
  const { row, data } = await loadIntegrationTicket(request)
  if (data.stateHash) throw createError({ statusCode: 409 })
  if (cancel) {
    const removed = await prisma.verification.deleteMany({
      where: { id: row.id, value: row.value, identifier: INTEGRATION_OAUTH_IDENTIFIER },
    })
    if (removed.count !== 1) throw createError({ statusCode: 409 })
    return { url: integrationSettingsUrl(data, 'cancelled') }
  }
  const user = await requireIntegrationActor(event, data)
  if (!(await consumeRateLimit(`integration-authorize:${user.id}`, 10, 600))) throw createError({ statusCode: 429 })
  if (data.provider === 'search-console') await requireSearchConsoleEligibility(data.tenantId)
  const secret = authTransferSecret()
  const state = `${request}.${secret}`
  const url = integrationOAuthUrl(data.provider, state)
  const updated = await prisma.verification.updateMany({
    where: { id: row.id, identifier: INTEGRATION_OAUTH_IDENTIFIER, value: row.value, expiresAt: { gt: new Date() } },
    data: {
      value: JSON.stringify({ ...data, stateHash: authTransferHash(secret) }),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  })
  if (updated.count !== 1) throw createError({ statusCode: 409 })
  setOAuthState(event, data.provider === 'linkedin' ? 'linkedin_oauth_state' : 'gsc_oauth_state', state, 600)
  return { url }
})

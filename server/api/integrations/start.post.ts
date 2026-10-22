import { z } from 'zod'

export default defineEventHandler(async (event) => {
  requireSameAuthOrigin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  const body = await readValidatedBody(
    event,
    z
      .object({
        provider: integrationProviderSchema,
        clientSiteId: z.string().optional(),
        locale: z.enum(['cs', 'en', 'de', 'fr']).optional(),
      })
      .strict().parse,
  )
  return createIntegrationTicket(event, body.provider, body.clientSiteId, body.locale)
})

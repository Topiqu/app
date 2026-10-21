import { z } from 'zod'

export default defineEventHandler(async (event) => {
  requireCentralAuth(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  if (!(await consumeRateLimit(`auth-transfer-preview:${getIp(event)}`, 30, 600)))
    throw createError({ statusCode: 429 })
  const { request } = await getValidatedQuery(event, z.object({ request: z.string().uuid() }).parse)
  const { data } = await loadAuthTransfer(request)
  if (data.codeHash) throw createError({ statusCode: 409 })
  return { host: new URL(data.origin).host }
})

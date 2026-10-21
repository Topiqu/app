import { z } from 'zod'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseHeader(event, 'referrer-policy', 'no-referrer')
  if (!(await consumeRateLimit(`auth-transfer-complete:${getIp(event)}`, 20, 600)))
    throw createError({ statusCode: 429 })
  const { request, code } = await getValidatedQuery(
    event,
    z.object({ request: z.string().uuid(), code: z.string().length(43) }).parse,
  )
  const cookie = z.object({ id: z.string().uuid(), proof: z.string().length(43) }).safeParse(parseCookie())
  function parseCookie() {
    try {
      return JSON.parse(getCookie(event, AUTH_TRANSFER_COOKIE) || 'null')
    } catch {
      return null
    }
  }
  if (!cookie.success || cookie.data.id !== request) throw createError({ statusCode: 403 })
  const { data } = await loadAuthTransfer(request)
  const instance = await authForEvent(event)
  const response = await instance.api.signInTransfer({
    headers: event.headers,
    body: { request, code, proof: cookie.data.proof },
    asResponse: true,
  })
  if (!response.ok) throw createError({ statusCode: 403 })
  for (const value of response.headers.getSetCookie()) appendResponseHeader(event, 'set-cookie', value)
  deleteCookie(event, AUTH_TRANSFER_COOKIE, authTransferCookieOptions)
  return sendRedirect(event, authReturnPath(data.returnPath, data.origin), 303)
})

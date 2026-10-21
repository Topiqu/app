import { z } from 'zod'

export default defineEventHandler(async (event) => {
  requireCentralAuth(event)
  requireSameAuthOrigin(event)
  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401 })
  if (!(await consumeRateLimit(`auth-transfer-authorize:${user.id}`, 10, 600))) throw createError({ statusCode: 429 })
  const { request } = await readValidatedBody(event, z.object({ request: z.string().uuid() }).strict().parse)
  const { row, data } = await loadAuthTransfer(request)
  if (data.codeHash) throw createError({ statusCode: 409 })
  const code = authTransferSecret()
  const updated = await prisma.verification.updateMany({
    where: { id: request, value: row.value, expiresAt: { gt: new Date() } },
    data: {
      value: JSON.stringify({ ...data, userId: user.id, sessionId: user.sessionId, codeHash: authTransferHash(code) }),
      expiresAt: new Date(Date.now() + 60_000),
    },
  })
  if (updated.count !== 1) throw createError({ statusCode: 409 })
  setResponseHeader(event, 'cache-control', 'no-store')
  const url = new URL('/api/auth/transfer/complete', data.origin)
  url.searchParams.set('request', request)
  url.searchParams.set('code', code)
  return { url: url.href }
})

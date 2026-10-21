import { z } from 'zod'
import { randomUUID } from 'node:crypto'

export default defineEventHandler(async (event) => {
  requireSameAuthOrigin(event)
  const origin = authTransferOrigin(event)
  const site = await requireTransferTarget(origin)
  if (!(await consumeRateLimit(`auth-transfer-start:${getIp(event)}`, 10, 600))) throw createError({ statusCode: 429 })
  const body = await readValidatedBody(
    event,
    z
      .object({
        returnTo: z.string().max(2048),
        locale: z.enum(['cs', 'en', 'de', 'fr']).default('en'),
        provider: z.enum(['google', 'github']).optional(),
      })
      .strict().parse,
  )
  const id = randomUUID()
  const proof = authTransferSecret()
  // Bounded cleanup of this flow's expired tickets; never touch OAuth/reset records.
  const expired = await prisma.verification.findMany({
    where: { identifier: AUTH_TRANSFER_IDENTIFIER, expiresAt: { lt: new Date() } },
    select: { id: true },
    take: 50,
  })
  if (expired.length)
    await prisma.verification.deleteMany({
      where: {
        id: { in: expired.map((entry) => entry.id) },
        identifier: AUTH_TRANSFER_IDENTIFIER,
        expiresAt: { lt: new Date() },
      },
    })
  await prisma.verification.create({
    data: {
      id,
      identifier: AUTH_TRANSFER_IDENTIFIER,
      expiresAt: new Date(Date.now() + 10 * 60_000),
      value: JSON.stringify({
        origin,
        tenantId: site.id,
        returnPath: authReturnPath(body.returnTo, origin),
        proofHash: authTransferHash(proof),
      }),
    },
  })
  setCookie(event, AUTH_TRANSFER_COOKIE, JSON.stringify({ id, proof }), { ...authTransferCookieOptions, maxAge: 600 })
  const target = new URL(`/${body.locale}/auth-transfer`, centralAuthOrigin())
  target.searchParams.set('request', id)
  if (body.provider) {
    const oauth = new URL(`/${body.locale}/oauth-start`, centralAuthOrigin())
    oauth.searchParams.set('provider', body.provider)
    oauth.searchParams.set('callbackUrl', target.href)
    return { url: oauth.href }
  }
  return { url: target.href }
})

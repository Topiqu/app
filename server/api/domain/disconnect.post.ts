import { z } from 'zod'
import { domainError, isManagedDomain, normalizeDomain } from '~~/shared/utils/domain'

import { attemptDomainCleanup, withDomainLease } from '../../utils/domains/connections'

export default defineEventHandler(async (event) => {
  const { db, user, clientSiteId } = await requireDomainAccess(event)
  if (!(await consumeRateLimit(`domain-disconnect:${clientSiteId}`, 5, 600))) throw createError({ statusCode: 429 })
  const body = await readValidatedBody(event, z.object({ fallback: z.string().max(253) }).strict().parse)
  const fallback = normalizeDomain(body.fallback)
  if (!isManagedDomain(fallback) || domainError(fallback, { allowCustom: false }))
    throw createError({ statusCode: 400 })
  const site = await db.clientSite.findUniqueOrThrow({
    where: { id: clientSiteId },
    select: { domain: true, pendingDomain: true },
  })
  if (site.pendingDomain) throw createError({ statusCode: 409, message: 'Cancel pending domain setup first' })
  if (isManagedDomain(site.domain) || (await isDomainTaken(fallback, clientSiteId)))
    throw createError({ statusCode: 409 })
  const connection = await db.domainConnection.findUnique({ where: { host: site.domain }, select: { id: true } })
  const disconnect = async () =>
    prisma.$transaction(async (tx) => {
      const updated = await tx.clientSite.updateMany({
        where: { id: clientSiteId, domain: site.domain, pendingDomain: null },
        data: {
          domain: fallback,
          domainVerified: true,
          domainVerificationStatus: 'VERIFIED',
          domainVerificationToken: null,
          domainVerificationIssuedAt: null,
          domainVerificationError: null,
          domainRoutingVerified: true,
          domainVerificationFailures: 0,
          domainVerificationDegradedAt: null,
        },
      })
      if (!updated.count) throw createError({ statusCode: 409 })
      await tx.domainRedirect.deleteMany({ where: { host: { in: [site.domain, fallback] }, clientSiteId } })
      if (connection)
        await tx.domainConnection.update({
          where: { id: connection.id },
          data: { state: 'DISCONNECTING', cleanupRequestedAt: new Date(), errorCode: null },
        })
    })
  if (connection) await withDomainLease(connection.id, disconnect)
  else await disconnect()
  await uncache(
    tenantHostKey(site.domain),
    tenantHostKey(fallback),
    domainRedirectKey(site.domain),
    domainRedirectKey(fallback),
  )
  await logAction({
    action: 'DOMAIN_DISCONNECTED',
    clientSiteId,
    userId: user.id,
    ip: getIp(event),
    metadata: { domain: site.domain, fallback },
  })
  if (connection) await attemptDomainCleanup(connection.id, clientSiteId)
  return { domain: fallback }
})

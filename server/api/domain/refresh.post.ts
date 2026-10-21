import { z } from 'zod'

import { reconcileDomainConnection } from '../../utils/domains/connections'

export default defineEventHandler(async (event) => {
  const { db, user, clientSiteId } = await requireDomainAccess(event)
  if (!(await consumeRateLimit(`domain-refresh:${clientSiteId}`, 5, 600))) throw createError({ statusCode: 429 })
  const body = await readValidatedBody(
    event,
    z.object({ connectionId: z.string().uuid().optional() }).strict().nullish().parse,
  )
  const site = await db.clientSite.findUniqueOrThrow({
    where: { id: clientSiteId },
    select: { domain: true, pendingDomain: true, domainVerificationToken: true },
  })
  const connection = await db.domainConnection.findUnique({
    where: {
      ...(body?.connectionId ? { id: body.connectionId } : { host: site.pendingDomain ?? site.domain }),
      clientSiteId,
    },
    select: { id: true, host: true, cleanupRequestedAt: true, state: true },
  })
  if (
    !connection ||
    (!connection.cleanupRequestedAt && connection.host !== site.domain && connection.host !== site.pendingDomain)
  )
    throw createError({ statusCode: 409, data: { code: 'setupRequired' } })
  if (connection.state === 'DISCONNECTED') return { ready: false, state: 'DISCONNECTED' }
  const result = await reconcileDomainConnection(connection.id, clientSiteId)
  if (result.ready && !connection.cleanupRequestedAt && !site.pendingDomain && connection.host === site.domain) {
    const changed = await db.clientSite.updateMany({
      where: {
        id: clientSiteId,
        domain: site.domain,
        domainVerificationToken: site.domainVerificationToken,
        plan: { not: 'BASIC' },
      },
      data: {
        domainVerified: true,
        domainVerificationStatus: 'VERIFIED',
        domainRoutingVerified: true,
        domainVerifiedAt: new Date(),
        domainLastCheckedAt: new Date(),
        domainVerificationFailures: 0,
        domainVerificationDegradedAt: null,
        domainVerificationError: null,
      },
    })
    if (changed.count) {
      await uncache(tenantHostKey(site.domain), domainRedirectKey(site.domain))
      await logAction({
        action: 'DOMAIN_VERIFICATION_SUCCEEDED',
        userId: user.id,
        clientSiteId,
        ip: getIp(event),
        metadata: { domain: site.domain },
      })
    }
  }
  return result
})

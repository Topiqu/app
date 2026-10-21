import { reconcileDomainConnection } from '../../../utils/domains/connections'

export default defineEventHandler(async (event) => {
  const { user, db, clientSiteId } = await requireDomainAccess(event)

  const allowed = await consumeRateLimit(`domain-verification:${clientSiteId}:${user.id}`, 5, 600)
  if (!allowed) {
    await logger.warn('domain verification rate limit exceeded', {
      source: 'domain-verification',
      userId: user.id,
      clientSiteId,
    })
    throw createError({ statusCode: 429, message: 'Too many verification attempts. Try again later.' })
  }

  const site = await db.clientSite.findUnique({ where: { id: clientSiteId } })
  if (!site) throw createError({ statusCode: 404, message: 'Client site not found' })
  if (!site.domainVerificationToken) throw createError({ statusCode: 409, message: 'Start domain verification first' })

  const result = await checkDomainDns(site.domain, site.domainVerificationToken)
  const connection = await db.domainConnection.findUnique({ where: { host: site.domain }, select: { id: true } })
  const provisioned = connection ? await reconcileDomainConnection(connection.id, clientSiteId) : null
  const verified = !!provisioned?.ready && result.ownershipVerified
  const reason = verified ? null : result.error || (!result.ownershipVerified ? 'TXT_MISMATCH' : 'ROUTING_MISMATCH')

  await db.clientSite.updateMany({
    where: { id: site.id, domain: site.domain, domainVerificationToken: site.domainVerificationToken },
    data: {
      // Manual refresh never takes a live publication offline; the scheduled security policy owns revocation.
      domainVerified: verified || site.domainVerified,
      domainVerificationStatus: verified ? 'VERIFIED' : site.domainVerificationStatus,
      domainVerifiedAt: verified ? new Date() : site.domainVerifiedAt,
      domainLastCheckedAt: new Date(),
      domainRoutingVerified: result.routingVerified,
      domainVerificationFailures: verified ? 0 : { increment: 1 },
      domainVerificationDegradedAt: verified ? null : site.domainVerificationDegradedAt,
      domainVerificationError: reason,
    },
  })

  await uncache(tenantHostKey(site.domain))

  await logAction({
    action: verified ? 'DOMAIN_VERIFICATION_SUCCEEDED' : 'DOMAIN_VERIFICATION_FAILED',
    userId: user.id,
    clientSiteId: site.id,
    ip: getIp(event),
    metadata: {
      domain: site.domain,
      ownershipVerified: result.ownershipVerified,
      routingVerified: result.routingVerified,
      dnsStatus: result.dnsStatus,
      routingTargets: result.routingTargets,
      reason,
    },
  })

  return {
    verified,
    ownership: { verified: result.ownershipVerified },
    routing: { verified: !!provisioned?.ready, actual: result.routingTargets },
    reason,
  }
})

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user?.id) throw createError({ statusCode: 401, message: 'Unauthorized' })
  if (!user.clientSiteId || !['admin', 'superadmin'].includes(user.role))
    throw createError({ statusCode: 403, message: 'Forbidden' })

  const allowed = await consumeRateLimit(`domain-verification:${user.clientSiteId}:${user.id}`, 5, 600)
  if (!allowed) {
    await logger.warn('domain verification rate limit exceeded', {
      source: 'domain-verification',
      userId: user.id,
      clientSiteId: user.clientSiteId,
    })
    throw createError({ statusCode: 429, message: 'Too many verification attempts. Try again later.' })
  }

  const db = await getEnhancedPrisma(user)
  const site = await db.clientSite.findUnique({ where: { id: user.clientSiteId } })
  if (!site) throw createError({ statusCode: 404, message: 'Client site not found' })
  if (!site.domainVerificationToken) throw createError({ statusCode: 409, message: 'Start domain verification first' })

  const result = await checkDomainDns(site.domain, site.domainVerificationToken)
  const verified = result.ownershipVerified && result.routingVerified
  const preserveGrandfatheredDomain = site.domainVerified && site.domainVerificationStatus === 'PENDING'
  const reason = verified ? null : result.error || (!result.ownershipVerified ? 'TXT_MISMATCH' : 'ROUTING_MISMATCH')

  await db.clientSite.update({
    where: { id: site.id },
    data: {
      domainVerified: verified || preserveGrandfatheredDomain,
      domainVerificationStatus: verified ? 'VERIFIED' : 'PENDING',
      domainVerifiedAt: verified ? new Date() : site.domainVerifiedAt,
      domainLastCheckedAt: new Date(),
      domainRoutingVerified: result.routingVerified,
      domainVerificationFailures: verified ? 0 : { increment: 1 },
      domainVerificationDegradedAt: null,
      domainVerificationError: reason,
    },
  })

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
    routing: { verified: result.routingVerified, actual: result.routingTargets },
    reason,
  }
})

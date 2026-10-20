import { domainError, isManagedDomain } from '~~/shared/utils/domain'

export default defineEventHandler(async (event) => {
  const { user, db, clientSiteId } = await requireDomainAccess(event)
  if (!(await consumeRateLimit(`domain-switch:${clientSiteId}`, 5, 600)))
    throw createError({ statusCode: 429, message: 'Too many verification attempts. Try again later.' })

  const site = await db.clientSite.findUnique({
    where: { id: clientSiteId },
    select: { domain: true, plan: true, pendingDomain: true, pendingDomainToken: true, pendingDomainRequestedAt: true },
  })
  if (!site?.pendingDomain || !site.pendingDomainToken)
    throw createError({ statusCode: 409, message: 'No domain change is pending' })
  const pending = site.pendingDomain
  const managed = isManagedDomain(pending)
  // Plan or ownership may have changed since the request.
  if (domainError(pending, { allowCustom: site.plan !== 'BASIC' }))
    throw createError({ statusCode: 403, message: 'Custom domains require the Pro plan', data: { code: 'plan' } })
  if (await isDomainTaken(pending, clientSiteId))
    throw createError({ statusCode: 409, message: 'Domain already taken', data: { code: 'taken' } })

  const dns = managed
    ? { ownershipVerified: true, routingVerified: true }
    : await checkDomainDns(pending, site.pendingDomainToken)
  if (!dns.ownershipVerified || !dns.routingVerified)
    return { verified: false, ownership: dns.ownershipVerified, routing: dns.routingVerified }

  const now = new Date()
  try {
    // System-scoped: redirect rows have no tenant write policy; only this proven swap creates them.
    await prisma.$transaction(async (tx) => {
      const swapped = await tx.clientSite.updateMany({
        where: { id: clientSiteId, pendingDomain: pending },
        data: {
          domain: pending,
          pendingDomain: null,
          pendingDomainToken: null,
          pendingDomainRequestedAt: null,
          // The TXT record stays in place, so domain-reverification keeps checking the same token.
          domainVerified: true,
          domainVerificationStatus: 'VERIFIED',
          domainVerificationToken: managed ? null : site.pendingDomainToken,
          domainVerificationIssuedAt: managed ? null : (site.pendingDomainRequestedAt ?? now),
          domainVerifiedAt: now,
          domainLastCheckedAt: now,
          domainRoutingVerified: true,
          domainVerificationFailures: 0,
          domainVerificationDegradedAt: null,
          domainVerificationError: null,
        },
      })
      if (!swapped.count) throw createError({ statusCode: 409, message: 'The domain change was cancelled' })
      await tx.domainRedirect.deleteMany({ where: { host: pending, clientSiteId } })
      await tx.domainRedirect.upsert({
        where: { host: site.domain },
        create: { host: site.domain, clientSiteId },
        update: { clientSiteId },
      })
    })
  } catch (error) {
    if (isUniqueViolation(error))
      throw createError({ statusCode: 409, message: 'Domain already taken', data: { code: 'taken' } })
    throw error
  }

  await uncache(
    tenantHostKey(site.domain),
    tenantHostKey(pending),
    domainRedirectKey(site.domain),
    domainRedirectKey(pending),
  )
  await logAction({
    action: 'DOMAIN_CHANGED',
    userId: user.id,
    clientSiteId,
    ip: getIp(event),
    metadata: { previousDomain: site.domain, domain: pending, redirected: true },
  })
  return { verified: true, domain: pending }
})

import { randomBytes } from 'crypto'

export default defineEventHandler(async (event) => {
  const { user, db, clientSiteId } = await requireDomainAccess(event)
  if (!(await consumeRateLimit(`domain-start:${clientSiteId}`, 10, 600))) throw createError({ statusCode: 429 })
  const site = await db.clientSite.findUnique({ where: { id: clientSiteId } })
  if (!site) throw createError({ statusCode: 404, message: 'Client site not found' })

  const domain = normalizeDomain(site.domain)
  let token = site.domainVerificationToken
  if (!token && !isManagedDomain(domain)) {
    token = randomBytes(24).toString('base64url')
    await prisma.$transaction(async (tx) => {
      const changed = await tx.clientSite.updateMany({
        where: { id: site.id, domain: site.domain, domainVerificationToken: null },
        data: { ...domainVerificationDefaults(domain, token!), domainVerified: site.domainVerified },
      })
      if (!changed.count) throw createError({ statusCode: 409, message: 'Domain setup changed' })
      await reserveDomainConnection(clientSiteId, domain, token!, tx)
    })
    await logAction({
      action: 'DOMAIN_VERIFICATION_STARTED',
      userId: user.id,
      clientSiteId: site.id,
      ip: getIp(event),
      metadata: { domain },
    })
  }

  if (token && !isManagedDomain(domain)) await reserveDomainConnection(clientSiteId, domain, token)

  return {
    domain,
    verified: site.domainVerified,
    status: site.domainVerificationStatus,
    txt: token ? { name: verificationRecordName(domain), value: verificationRecordValue(token) } : null,
    routing: { type: 'CNAME' as const, name: domain, value: DOMAIN_ROUTING_TARGET },
  }
})

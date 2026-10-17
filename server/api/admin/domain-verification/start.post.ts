import { randomBytes } from 'crypto'
import { domainVerificationDefaults, normalizeDomain } from '~~/shared/utils/domain'

export default defineEventHandler(async (event) => {
  const { user, db, clientSiteId } = await requireDomainAccess(event)
  const site = await db.clientSite.findUnique({ where: { id: clientSiteId } })
  if (!site) throw createError({ statusCode: 404, message: 'Client site not found' })

  const domain = normalizeDomain(site.domain)
  let token = site.domainVerificationToken
  if (!token && !site.domainVerified) {
    token = randomBytes(24).toString('base64url')
    await db.clientSite.update({
      where: { id: site.id },
      data: domainVerificationDefaults(domain, token),
    })
    await logAction({
      action: 'DOMAIN_VERIFICATION_STARTED',
      userId: user.id,
      clientSiteId: site.id,
      ip: getIp(event),
      metadata: { domain },
    })
  }

  return {
    domain,
    verified: site.domainVerified,
    status: site.domainVerificationStatus,
    txt: token ? { name: verificationRecordName(domain), value: verificationRecordValue(token) } : null,
    routing: { type: 'CNAME' as const, name: domain, value: DOMAIN_ROUTING_TARGET },
  }
})

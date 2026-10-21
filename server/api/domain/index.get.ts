import { domainConnectionPublicSelect } from '../../utils/domains/connections'

export default defineEventHandler(async (event) => {
  const { db, clientSiteId } = await requireDomainAccess(event)
  const site = await db.clientSite.findUnique({
    where: { id: clientSiteId },
    select: { domain: true, plan: true, pendingDomain: true, pendingDomainToken: true, domainVerificationToken: true },
  })
  if (!site) throw createError({ statusCode: 404, message: 'Client site not found' })
  const connections = await db.domainConnection.findMany({
    where: { clientSiteId, state: { not: 'DISCONNECTED' } },
    select: { ...domainConnectionPublicSelect, challenge: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return {
    domain: site.domain,
    connections: connections.map(({ challenge, ...connection }) => ({
      ...connection,
      dns: domainDnsRecords(connection.host, challenge),
    })),
    currentVerification: site.domainVerificationToken
      ? domainDnsRecords(site.domain, site.domainVerificationToken)
      : null,
    canUseCustomDomain: site.plan !== 'BASIC',
    pending:
      site.pendingDomain && site.pendingDomainToken
        ? domainDnsRecords(site.pendingDomain, site.pendingDomainToken)
        : null,
  }
})

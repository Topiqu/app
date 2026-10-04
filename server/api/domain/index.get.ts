export default defineEventHandler(async (event) => {
  const { db, clientSiteId } = await requireDomainAccess(event)
  const site = await db.clientSite.findUnique({
    where: { id: clientSiteId },
    select: { domain: true, plan: true, pendingDomain: true, pendingDomainToken: true },
  })
  if (!site) throw createError({ statusCode: 404, message: 'Client site not found' })

  return {
    domain: site.domain,
    canUseCustomDomain: site.plan !== 'BASIC',
    pending:
      site.pendingDomain && site.pendingDomainToken ? domainDnsRecords(site.pendingDomain, site.pendingDomainToken) : null,
  }
})

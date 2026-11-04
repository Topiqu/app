type DomainRetirementDb = Pick<DatabaseTransaction, 'clientSite' | 'domainConnection' | 'domainRedirect'>

/** The caller holds the ClientSite row lock. Retire the hostname in the same commit
 * as the downgrade; provider APIs run later, using the durable cleanup marker. */
export const retireUnpaidCustomDomains = async (tx: DomainRetirementDb, clientSiteId: string) => {
  const site = await tx.clientSite.findUniqueOrThrow({
    where: { id: clientSiteId },
    select: { domain: true, pendingDomain: true },
  })
  const custom = !isManagedDomain(site.domain)
  const pendingCustom = site.pendingDomain && !isManagedDomain(site.pendingDomain)
  if (custom) {
    const fallback = await chooseDomainFallback(clientSiteId, tx)
    await tx.clientSite.update({
      where: { id: clientSiteId },
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
    await tx.domainRedirect.deleteMany({ where: { clientSiteId, host: { in: [site.domain, fallback] } } })
  }
  if (custom || pendingCustom)
    await tx.clientSite.updateMany({
      where: { id: clientSiteId },
      data: { pendingDomain: null, pendingDomainToken: null, pendingDomainRequestedAt: null },
    })
  // Preserve leases and provider IDs: an in-flight provisioner may still need to
  // record a resource it created before it noticed the downgrade.
  await tx.domainConnection.updateMany({
    where: { clientSiteId, state: { not: 'DISCONNECTED' }, cleanupRequestedAt: null },
    data: { state: 'DISCONNECTING', cleanupRequestedAt: new Date() },
  })
}

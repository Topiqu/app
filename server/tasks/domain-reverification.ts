export default defineMonitoredTask({
  meta: {
    name: 'domain-reverification',
    description: 'Reverify custom-domain ownership and routing, degrading only after repeated failures',
  },
  async run() {
    const sites = await prisma.clientSite.findMany({
      where: {
        domainVerificationToken: { not: null },
        domainVerificationIssuedAt: { not: null },
        domainVerificationStatus: { in: ['VERIFIED', 'DEGRADED'] },
        deletedAt: null,
      },
      select: {
        id: true,
        domain: true,
        domainVerificationToken: true,
        domainVerificationStatus: true,
        domainVerificationFailures: true,
        domainVerificationDegradedAt: true,
      },
      take: 200,
    })

    let verified = 0
    let degraded = 0
    let failed = 0

    for (const site of sites) {
      const result = await checkDomainDns(site.domain, site.domainVerificationToken!)
      const ok = result.ownershipVerified && result.routingVerified
      const now = new Date()

      if (ok) {
        const recovered = site.domainVerificationStatus === 'DEGRADED'
        await prisma.clientSite.update({
          where: { id: site.id },
          data: {
            domainVerified: true,
            domainVerificationStatus: 'VERIFIED',
            domainLastCheckedAt: now,
            domainRoutingVerified: true,
            domainVerificationFailures: 0,
            domainVerificationDegradedAt: null,
            domainVerificationError: null,
          },
        })
        if (recovered)
          await logAction({
            action: 'DOMAIN_VERIFICATION_RECOVERED',
            clientSiteId: site.id,
            metadata: { domain: site.domain },
          })
        verified++
        continue
      }

      const next = nextReverificationState({
        failures: site.domainVerificationFailures,
        status: site.domainVerificationStatus === 'DEGRADED' ? 'DEGRADED' : 'VERIFIED',
        degradedAt: site.domainVerificationDegradedAt,
        now,
      })
      const reason = result.error || (!result.ownershipVerified ? 'TXT_MISMATCH' : 'ROUTING_MISMATCH')

      await prisma.clientSite.update({
        where: { id: site.id },
        data: {
          domainVerified: next.domainVerified,
          domainVerificationStatus: next.status,
          domainLastCheckedAt: now,
          domainRoutingVerified: result.routingVerified,
          domainVerificationFailures: next.failures,
          domainVerificationDegradedAt: next.degradedAt,
          domainVerificationError: reason,
        },
      })

      if (next.status === 'DEGRADED' && site.domainVerificationStatus !== 'DEGRADED') {
        await logAction({
          action: 'DOMAIN_VERIFICATION_DEGRADED',
          clientSiteId: site.id,
          metadata: { domain: site.domain, failures: next.failures, reason },
        })
        const admins = await prisma.user.findMany({
          where: { clientSiteId: site.id, role: 'admin', allowNotifs: true },
          select: { id: true },
        })
        if (admins.length)
          await prisma.notification.createMany({
            data: admins.map((admin) => ({
              userId: admin.id,
              type: 'SYSTEM',
              message: `DNS verification for ${site.domain} is failing. Fix it within 7 days.`,
              link: '/admin',
            })),
          })
        degraded++
      } else if (next.status === 'FAILED') {
        await logAction({
          action: 'DOMAIN_VERIFICATION_REVOKED',
          clientSiteId: site.id,
          metadata: { domain: site.domain, failures: next.failures, reason },
        })
        failed++
      }
    }

    return { result: { checked: sites.length, verified, degraded, failed } }
  },
})

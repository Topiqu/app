import { DomainProviderError } from '../utils/domains/providers'
import { chooseDomainFallback } from '../utils/domains/fallback'
import { nextReverificationState } from '../utils/domainVerification'
import { reconcileDomainConnection } from '../utils/domains/connections'
import { domainAdminNotifications } from '../utils/domains/notifications'

export default defineMonitoredTask({
  meta: {
    name: 'domain-reverification',
    description: 'Reverify custom-domain ownership and routing, degrading only after repeated failures',
  },
  async run() {
    const deadline = Date.now() + 45000
    const expiring = await prisma.domainConnection.findMany({
      where: {
        state: { notIn: ['DISCONNECTED', 'DISCONNECTING'] },
        certificateMode: 'CUSTOM',
        certificateWarnedAt: null,
        certificateExpiresAt: { lte: new Date(Date.now() + 14 * 86400000) },
      },
      select: { id: true, host: true, clientSiteId: true, certificateFingerprint: true },
      take: 20,
    })
    for (const connection of expiring) {
      if (Date.now() >= deadline) break
      const notifications = await domainAdminNotifications(
        connection.clientSiteId,
        'common.domain.provisioning.expiringNotification',
        connection.host,
      )
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.domainConnection.updateMany({
          where: {
            id: connection.id,
            certificateWarnedAt: null,
            certificateFingerprint: connection.certificateFingerprint,
          },
          data: { certificateWarnedAt: new Date() },
        })
        if (claimed.count && notifications.length) await tx.notification.createMany({ data: notifications })
      })
    }
    // Cleanup is retried independently of live domains, including abandoned setup attempts.
    const cleanup = await prisma.domainConnection.findMany({
      where: {
        state: { not: 'DISCONNECTED' },
        OR: [
          { cleanupRequestedAt: { not: null } },
          { state: { not: 'READY' } },
          { clientSite: { deletedAt: { not: null } } },
          { clientSite: { pendingDomain: { not: null } } },
        ],
      },
      select: { id: true },
      orderBy: { checkedAt: { sort: 'asc', nulls: 'first' } },
      take: 20,
    })
    for (const connection of cleanup) {
      if (Date.now() >= deadline) break
      try {
        await reconcileDomainConnection(connection.id)
      } catch (error) {
        if (!(error instanceof DomainProviderError && error.code === 'BUSY'))
          await reportCaughtError('Domain cleanup failed', new Error('DOMAIN_CLEANUP_FAILED'), {
            connectionId: connection.id,
          })
      }
    }
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
      orderBy: [{ domainLastCheckedAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
    })

    let verified = 0
    let degraded = 0
    let failed = 0

    for (const site of sites) {
      if (Date.now() >= deadline) break
      const result = await checkDomainDns(site.domain, site.domainVerificationToken!)
      const connection = await prisma.domainConnection.findUnique({
        where: { host: site.domain },
        select: { id: true },
      })
      let provisioned: Awaited<ReturnType<typeof reconcileDomainConnection>> | null = null
      if (connection) {
        try {
          provisioned = await reconcileDomainConnection(connection.id)
        } catch (error) {
          if (error instanceof DomainProviderError && error.code === 'BUSY') continue
          throw error
        }
      }
      const ok = result.ownershipVerified && (connection ? !!provisioned?.ready : result.routingVerified)
      const now = new Date()
      // Resolver/provider outages do not prove a loss of domain ownership.
      if ((result.dnsStatus.txt !== 0 && result.dnsStatus.txt !== 3) || provisioned?.transient) {
        await prisma.clientSite.updateMany({
          where: { id: site.id, domain: site.domain, domainVerificationToken: site.domainVerificationToken },
          data: { domainLastCheckedAt: now, domainVerificationError: 'DNS_OR_PROVIDER_UNAVAILABLE' },
        })
        continue
      }

      if (ok) {
        const recovered = site.domainVerificationStatus === 'DEGRADED'
        await prisma.clientSite.updateMany({
          where: { id: site.id, domain: site.domain, domainVerificationToken: site.domainVerificationToken },
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
        await uncache(tenantHostKey(site.domain), domainRedirectKey(site.domain))
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
        // A confirmed lost TXT is a security failure, not a seven-day infrastructure grace period.
        gracePeriodMs: !result.ownershipVerified || provisioned?.state === 'PLAN_REQUIRED' ? 0 : undefined,
      })
      const reason = result.error || (!result.ownershipVerified ? 'TXT_MISMATCH' : 'ROUTING_MISMATCH')

      const fallback = next.status === 'FAILED' && connection ? await chooseDomainFallback(site.id) : null
      const changed = await prisma.$transaction(async (tx) => {
        const changed = await tx.clientSite.updateMany({
          where: {
            id: site.id,
            domain: site.domain,
            domainVerificationToken: site.domainVerificationToken,
            domainVerificationFailures: site.domainVerificationFailures,
          },
          data: {
            domainVerified: next.domainVerified,
            domainVerificationStatus: next.status,
            domainLastCheckedAt: now,
            domainRoutingVerified: connection ? !!provisioned?.ready : result.routingVerified,
            domainVerificationFailures: next.failures,
            domainVerificationDegradedAt: next.degradedAt,
            domainVerificationError: reason,
            ...(fallback
              ? {
                  domain: fallback,
                  domainVerified: true,
                  domainVerificationStatus: 'VERIFIED' as const,
                  domainRoutingVerified: true,
                  domainVerificationFailures: 0,
                  domainVerificationDegradedAt: null,
                  domainVerificationToken: null,
                  domainVerificationIssuedAt: null,
                }
              : {}),
          },
        })
        if (changed.count && fallback && connection) {
          await tx.domainRedirect.deleteMany({
            where: { host: { in: [fallback, site.domain] }, clientSiteId: site.id },
          })
          await tx.domainConnection.updateMany({
            where: { id: connection.id, clientSiteId: site.id, host: site.domain },
            data: { cleanupRequestedAt: now, state: 'DISCONNECTING' },
          })
        }
        return changed
      })
      if (!changed.count) continue
      await uncache(tenantHostKey(site.domain), domainRedirectKey(site.domain))
      if (fallback) await uncache(tenantHostKey(fallback), domainRedirectKey(fallback))

      if (next.status === 'DEGRADED' && site.domainVerificationStatus !== 'DEGRADED') {
        await logAction({
          action: 'DOMAIN_VERIFICATION_DEGRADED',
          clientSiteId: site.id,
          metadata: { domain: site.domain, failures: next.failures, reason },
        })
        const notifications = await domainAdminNotifications(
          site.id,
          'common.domain.provisioning.degradedNotification',
          site.domain,
        )
        if (notifications.length) await prisma.notification.createMany({ data: notifications })
        degraded++
      } else if (next.status === 'FAILED') {
        const notifications = await domainAdminNotifications(
          site.id,
          'common.domain.provisioning.revokedNotification',
          site.domain,
        )
        if (notifications.length) await prisma.notification.createMany({ data: notifications })
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

import { buildEarningRow } from '~~/server/utils/adRevenue'
import { fetchGamRevenueByClient, isGamConfigured } from '~~/server/utils/ads/gamReport'

const previousUtcDay = (now: Date): { start: Date; end: Date } => {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 1)
  return { start, end }
}

export default defineMonitoredTask({
  meta: {
    name: 'gam-sync',
    description:
      'Ingest GAM per-client ad revenue for the previous day and upsert the AdEarning ledger (split by plan share)',
  },
  async run() {
    const now = new Date()

    if (!isGamConfigured()) {
      return { result: { synced: 0, skipped: 0, configured: false, timestamp: now.toISOString() } }
    }

    const period = previousUtcDay(now)
    const revenues = await fetchGamRevenueByClient(period)

    if (!revenues.length) {
      return { result: { synced: 0, skipped: 0, configured: true, timestamp: now.toISOString() } }
    }

    const sites = await prisma.clientSite.findMany({
      where: { id: { in: revenues.map((r) => r.clientSiteId) } },
      select: { id: true, plan: true },
    })
    const planById = new Map(sites.map((s) => [s.id, s.plan]))

    let synced = 0
    let skipped = 0

    for (const revenue of revenues) {
      const plan = planById.get(revenue.clientSiteId)
      if (!plan) {
        skipped++
        continue
      }

      const row = buildEarningRow({
        clientSiteId: revenue.clientSiteId,
        grossCents: revenue.grossCents,
        currency: revenue.currency,
        plan,
      })

      await prisma.adEarning.upsert({
        where: {
          clientSiteId_periodStart_periodEnd: {
            clientSiteId: revenue.clientSiteId,
            periodStart: period.start,
            periodEnd: period.end,
          },
        },
        create: {
          clientSiteId: row.clientSiteId,
          periodStart: period.start,
          periodEnd: period.end,
          currency: row.currency,
          plan: row.plan,
          shareRatio: row.shareRatio,
          grossCents: row.grossCents,
          clientCents: row.clientCents,
          platformCents: row.platformCents,
        },
        update: {
          currency: row.currency,
          plan: row.plan,
          shareRatio: row.shareRatio,
          grossCents: row.grossCents,
          clientCents: row.clientCents,
          platformCents: row.platformCents,
        },
      })
      synced++
    }

    return { result: { synced, skipped, configured: true, timestamp: now.toISOString() } }
  },
})

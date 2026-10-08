import { hasDataForSeo } from '~~/server/utils/keywords/dataforseo'
import { BACKLINK_DAY_MS, BACKLINK_DISCOVERY_DAYS } from '~~/shared/utils/backlinks'
import { BACKLINK_PLANS, discoverBacklinks } from '~~/server/utils/backlinks/discover'

const SITES_PER_RUN = 20

export default defineMonitoredTask({
  meta: {
    name: 'backlink-discovery',
    description: 'Find pages that mention a tenant without a link and manufacturers whose dealer page omits it',
  },
  async run() {
    if (!hasDataForSeo()) return { result: { skipped: 'provider' } }
    const now = new Date()
    const due = await prisma.clientSite.findMany({
      where: {
        plan: { in: [...BACKLINK_PLANS] },
        deletedAt: null,
        ...activeFeatureFilter('AI'),
        OR: [
          { backlinksAttemptedAt: null },
          { backlinksAttemptedAt: { lt: new Date(now.getTime() - BACKLINK_DISCOVERY_DAYS * BACKLINK_DAY_MS) } },
        ],
      },
      select: { id: true },
      orderBy: { backlinksAttemptedAt: { sort: 'asc', nulls: 'first' } },
      take: SITES_PER_RUN,
    })
    let discovered = 0
    let failed = 0
    let costUsd = 0
    for (const site of due) {
      try {
        const summary = await discoverBacklinks(site.id, { now })
        if ('costUsd' in summary) {
          discovered += 1
          costUsd += summary.costUsd
        }
      } catch (error) {
        failed += 1
        await reportCaughtError('Backlink discovery failed', error, { clientSiteId: site.id })
      }
    }
    return { result: { due: due.length, discovered, failed, costUsd: Math.round(costUsd * 10_000) / 10_000 } }
  },
})

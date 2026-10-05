import { planProfile } from '~~/server/utils/keywords/plan'
import { rankHistoryFor } from '~~/server/utils/keywords/rank'
import { keywordOpportunity } from '~~/shared/utils/keywordOpportunity'
import { keywordMarketFor, keywordMarketsFor } from '~~/shared/utils/keywordPlan'

const ORDER = { PINNED: 0, OPEN: 1, SKIPPED: 2, USED: 3 } as const

export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { role: ['admin', 'superadmin'], clientSite: true })
  const clientSiteId = user.clientSiteId!
  if (user.role !== 'superadmin') await requireTenantScope(event, 'AI_USE', clientSiteId)

  const [site, clusters, written, totals, aiEnabled, cronsEnabled] = await Promise.all([
    db.clientSite.findUnique({
      where: { id: clientSiteId },
      select: {
        keywordPlanRefreshedAt: true,
        keywordMarket: true,
        language: true,
        domain: true,
        focus: true,
        audience: true,
        keywords: true,
      },
    }),
    Promise.all(
      (['PINNED', 'OPEN', 'SKIPPED'] as const).map((status) =>
        db.keywordCluster.findMany({
          where: { clientSiteId, status },
          select: {
            id: true,
            keyword: true,
            volume: true,
            difficulty: true,
            pillar: true,
            status: true,
            opportunity: true,
          },
          // The generator offers pins newest first (`keywordPlanFor`); the list shows that queue order.
          orderBy: status === 'PINNED' ? { updatedAt: 'desc' } : { score: 'desc' },
          take: 30,
        }),
      ),
    ).then((groups) => groups.flat()),
    db.keywordCluster.findMany({
      where: { clientSiteId, status: 'USED' },
      select: {
        id: true,
        keyword: true,
        position: true,
        rankHistory: true,
        article: { select: { id: true, title: true } },
      },
      orderBy: { usedAt: 'desc' },
      take: 50,
    }),
    db.keywordCluster.aggregate({ where: { clientSiteId, status: 'USED' }, _count: true, _sum: { volume: true } }),
    hasActiveFeature(prisma, clientSiteId, 'AI'),
    hasActiveFeature(prisma, clientSiteId, 'ARTICLE_CRONS'),
  ])
  const language = site?.language ?? 'en'
  // The generator only offers topics assessed for the current focus, language, market and domain
  // (`keywordPlanFor`); the list shows the same set, so a pin here is a pin it will act on.
  const profile = site ? planProfile({ id: clientSiteId, ...site }) : null
  return {
    // The plan only feeds scheduled articles; without them the page explains how to turn them on.
    enabled: aiEnabled && cronsEnabled,
    written: { topics: totals._count, volume: totals._sum.volume ?? 0 },
    refreshedAt: site?.keywordPlanRefreshedAt ?? null,
    market: keywordMarketFor(language, site?.keywordMarket),
    markets: keywordMarketsFor(language),
    clusters: clusters
      .flatMap(({ opportunity: raw, ...cluster }) => {
        const opportunity = keywordOpportunity(raw)
        return opportunity && opportunity.profile === profile ? [{ ...cluster, reason: opportunity.reason }] : []
      })
      .sort((a, b) => ORDER[a.status] - ORDER[b.status])
      .slice(0, 30),
    // The first reading is the baseline the change is measured from.
    results: written.flatMap(({ rankHistory, ...cluster }) => {
      const history = site ? rankHistoryFor(rankHistory, site) : []
      if (!history.length) return []
      const latest = history.at(-1)!
      return [
        {
          ...cluster,
          position: latest.position,
          url: latest.url && /^https?:\/\//.test(latest.url) ? latest.url : null,
          firstPosition: history[0]!.position,
          checkedAt: latest.at,
        },
      ]
    }),
  }
})

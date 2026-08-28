export interface SearchPerformance {
  page: string
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}
export type OpportunityType = 'STRIKING_DISTANCE' | 'LOW_CTR'
export type SearchOpportunity = { type: OpportunityType; score: number; reason: SearchPerformance }

export interface SearchTrend extends SearchPerformance {
  previousImpressions: number
  impressionGrowth: number | null
}

export const detectSearchOpportunities = (rows: SearchPerformance[]) =>
  rows
    .flatMap((row) => {
      const opportunities: SearchOpportunity[] = []
      if (row.impressions >= 100 && row.position >= 4 && row.position <= 20) {
        const score = Math.min(100, Math.round(Math.log10(row.impressions + 1) * 20 + (21 - row.position) * 2))
        opportunities.push({ type: 'STRIKING_DISTANCE', score, reason: row })
      }
      if (row.impressions >= 100 && row.position <= 10 && row.ctr < 0.02)
        opportunities.push({
          type: 'LOW_CTR',
          score: Math.min(100, Math.round(Math.log10(row.impressions + 1) * 25)),
          reason: row,
        })
      return opportunities
    })
    .sort((a, b) => b.score - a.score)

export const getSearchOpportunities = async (clientSiteId: string, days = 28, take = 50) => {
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)

  const rows = await prisma.searchConsoleMetric.groupBy({
    by: ['page', 'query'],
    where: { clientSiteId, date: { gte: since } },
    _sum: { clicks: true, impressions: true },
    _avg: { ctr: true, position: true },
    orderBy: { _sum: { impressions: 'desc' } },
    take: 500,
  })

  return detectSearchOpportunities(
    rows.map((row) => ({
      page: row.page,
      query: row.query,
      clicks: row._sum.clicks ?? 0,
      impressions: row._sum.impressions ?? 0,
      ctr: row._sum.impressions ? (row._sum.clicks ?? 0) / row._sum.impressions : 0,
      position: row._avg.position ?? 0,
    })),
  ).slice(0, take)
}

const groupedPerformance = async (clientSiteId: string, from: Date, to: Date) =>
  prisma.searchConsoleMetric.groupBy({
    by: ['page', 'query'],
    where: { clientSiteId, date: { gte: from, lt: to }, query: { not: '' } },
    _sum: { clicks: true, impressions: true },
    _avg: { position: true },
    orderBy: { _sum: { impressions: 'desc' } },
    take: 1000,
  })

/** Current-vs-previous demand, used only by the autonomous writer. */
export const getSearchTrends = async (clientSiteId: string, days = 28): Promise<SearchTrend[]> => {
  const latest = await prisma.searchConsoleMetric.aggregate({
    where: { clientSiteId },
    _max: { date: true },
  })
  if (!latest._max.date) return []

  // Anchor both equal windows to the latest finalised GSC day. Anchoring to wall-clock "now"
  // would put Google's normal two-day reporting delay only into the current period and make
  // every trend look artificially weaker.
  const currentTo = new Date(latest._max.date)
  currentTo.setUTCDate(currentTo.getUTCDate() + 1)
  const currentFrom = new Date(currentTo)
  currentFrom.setUTCDate(currentFrom.getUTCDate() - days)
  const previousFrom = new Date(currentFrom)
  previousFrom.setUTCDate(previousFrom.getUTCDate() - days)

  const [current, previous] = await Promise.all([
    groupedPerformance(clientSiteId, currentFrom, currentTo),
    groupedPerformance(clientSiteId, previousFrom, currentFrom),
  ])
  const previousByKey = new Map(
    previous.map((row) => [`${row.page}\u0000${row.query}`, row._sum.impressions ?? 0] as const),
  )

  return current.map((row) => {
    const impressions = row._sum.impressions ?? 0
    const clicks = row._sum.clicks ?? 0
    const previousImpressions = previousByKey.get(`${row.page}\u0000${row.query}`) ?? 0
    return {
      page: row.page,
      query: row.query,
      clicks,
      impressions,
      ctr: impressions ? clicks / impressions : 0,
      position: row._avg.position ?? 0,
      previousImpressions,
      impressionGrowth:
        previousImpressions > 0 ? (impressions - previousImpressions) / previousImpressions : impressions > 0 ? 1 : null,
    }
  })
}

/** Compact enrichment for the editor. Search data raises priority; it never becomes a topic brief itself. */
export const searchOpportunitySignal = (opportunity: SearchOpportunity) => {
  const { query, impressions, ctr, position } = opportunity.reason
  const reason = opportunity.type === 'LOW_CTR' ? 'low click-through rate' : 'ranking within reach of page one'
  const observedQuery = query.replace(/\s+/g, ' ').trim().slice(0, 160)
  return `Observed query "${observedQuery}" has ${Math.round(impressions)} impressions, average position ${position.toFixed(1)} and ${(ctr * 100).toFixed(1)}% CTR (${reason}).`
}

export const searchTrendSignal = (trend: SearchTrend) => {
  const observedQuery = trend.query.replace(/\s+/g, ' ').trim().slice(0, 160)
  const growth = trend.impressionGrowth === null ? 'unknown growth' : `${Math.round(trend.impressionGrowth * 100)}% growth`
  return `Observed uncovered query "${observedQuery}" has ${Math.round(trend.impressions)} impressions, average position ${trend.position.toFixed(1)} and ${growth} versus the previous period.`
}

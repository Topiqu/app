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
      ctr: row._avg.ctr ?? 0,
      position: row._avg.position ?? 0,
    })),
  ).slice(0, take)
}

/** Compact enrichment for the editor. Search data raises priority; it never becomes a topic brief itself. */
export const searchOpportunitySignal = (opportunity: SearchOpportunity) => {
  const { query, impressions, ctr, position } = opportunity.reason
  const reason = opportunity.type === 'LOW_CTR' ? 'low click-through rate' : 'ranking within reach of page one'
  const observedQuery = query.replace(/\s+/g, ' ').trim().slice(0, 160)
  return `Observed query "${observedQuery}" has ${Math.round(impressions)} impressions, average position ${position.toFixed(1)} and ${(ctr * 100).toFixed(1)}% CTR (${reason}).`
}

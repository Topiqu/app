export interface SearchPerformance {
  page: string
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}
export type OpportunityType = 'STRIKING_DISTANCE' | 'LOW_CTR'

export const detectSearchOpportunities = (rows: SearchPerformance[]) =>
  rows
    .flatMap((row) => {
      const opportunities: { type: OpportunityType; score: number; reason: SearchPerformance }[] = []
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

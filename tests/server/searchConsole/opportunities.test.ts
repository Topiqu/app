import { describe, expect, it } from 'vitest'

import { detectSearchOpportunities } from '../../../server/utils/searchConsole/opportunities'

describe('detectSearchOpportunities', () => {
  it('finds striking-distance queries and ignores low-volume noise', () => {
    const result = detectSearchOpportunities([
      { page: '/a', query: 'useful', clicks: 8, impressions: 1200, ctr: 0.03, position: 8 },
      { page: '/b', query: 'noise', clicks: 0, impressions: 20, ctr: 0, position: 9 },
    ])
    expect(result.some((item) => item.type === 'STRIKING_DISTANCE' && item.reason.query === 'useful')).toBe(true)
    expect(result.some((item) => item.reason.query === 'noise')).toBe(false)
  })

  it('flags low CTR on page one', () => {
    const result = detectSearchOpportunities([{ page: '/a', query: 'query', clicks: 2, impressions: 500, ctr: 0.004, position: 4 }])
    expect(result.map((item) => item.type)).toContain('LOW_CTR')
  })
})

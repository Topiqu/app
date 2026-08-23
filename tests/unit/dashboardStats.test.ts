import { describe, expect, it } from 'vitest'

import {
  VIEW_TREND_DAYS,
  engagementRate,
  fillDailySeries,
  involvementCounts,
  lastDays,
  topThreeShare,
} from '../../server/utils/dashboardStats'

const article = (
  views: number,
  counts: Partial<Record<'reactions' | 'comments' | 'pollResults' | 'shares', number>>,
) => ({
  views,
  _count: { reactions: 0, comments: 0, pollResults: 0, shares: 0, ...counts },
})

describe('lastDays', () => {
  it('returns the window oldest first, ending today', () => {
    const days = lastDays(3, new Date('2026-08-19T14:30:00Z'))
    expect(days).toEqual(['2026-08-17', '2026-08-18', '2026-08-19'])
  })

  it('buckets on UTC, not the server timezone', () => {
    // 23:30 in Prague on the 19th is already the 19th in UTC; 00:30 on the 20th is not the 20th
    // everywhere, but the view log stores UTC dates, so the window must agree with it.
    expect(lastDays(1, new Date('2026-08-19T23:30:00Z'))).toEqual(['2026-08-19'])
    expect(lastDays(1, new Date('2026-08-20T00:30:00Z'))).toEqual(['2026-08-20'])
  })

  it('crosses a month boundary', () => {
    expect(lastDays(2, new Date('2026-09-01T10:00:00Z'))).toEqual(['2026-08-31', '2026-09-01'])
  })
})

describe('engagementRate', () => {
  it('is interactions over views across the whole site', () => {
    const rate = engagementRate([article(100, { reactions: 5 }), article(100, { comments: 5 })])
    expect(rate).toBeCloseTo(10 / 200)
  })

  it('does not let a one-view article outweigh a well-read one', () => {
    // The old mean-of-ratios formula scored this (3/1 + 10/1000) / 2 = 150%; the honest ratio
    // is 13 interactions across 1001 views.
    const rate = engagementRate([article(1, { comments: 3 }), article(1000, { reactions: 10 })])

    expect(rate).toBeCloseTo(13 / 1001)
    expect(rate).toBeLessThan(1)
  })

  it('counts every interaction kind once', () => {
    const rate = engagementRate([article(10, { reactions: 1, comments: 1, shares: 1, pollResults: 1 })])
    expect(rate).toBeCloseTo(0.4)
  })

  it('is zero when nothing has been read', () => {
    expect(engagementRate([])).toBe(0)
    expect(engagementRate([article(0, { comments: 4 })])).toBe(0)
  })
})

describe('topThreeShare', () => {
  it('measures how much readership the three best articles carry', () => {
    expect(topThreeShare([50, 30, 20, 100])).toBeCloseTo(180 / 200)
  })

  it('does not mutate the caller’s array', () => {
    const views = [1, 9, 5]
    topThreeShare(views)
    expect(views).toEqual([1, 9, 5])
  })

  it('is 1 when there are three or fewer articles', () => {
    expect(topThreeShare([7, 3])).toBe(1)
  })

  it('is zero without views', () => {
    expect(topThreeShare([])).toBe(0)
    expect(topThreeShare([0, 0])).toBe(0)
  })
})

describe('involvementCounts', () => {
  it('fills the variants groupBy omitted', () => {
    const counts = involvementCounts([{ aiInvolvement: 'FULL', _count: { _all: 4 } }])
    expect(counts).toEqual({ FULL: 4, ASSIST: 0, NONE: 0 })
  })
})

describe('fillDailySeries', () => {
  const now = new Date('2026-08-19T08:00:00Z')

  it('emits a point per day, zero-filling the gaps', () => {
    const series = fillDailySeries([{ date: new Date('2026-08-18T00:00:00Z'), views: 7 }], 3, now)

    expect(series).toEqual([
      { date: '2026-08-17', views: 0 },
      { date: '2026-08-18', views: 7 },
      { date: '2026-08-19', views: 0 },
    ])
  })

  it('coerces the bigint a COUNT() comes back as', () => {
    const series = fillDailySeries([{ date: new Date('2026-08-19T00:00:00Z'), views: 3n as unknown as number }], 1, now)
    expect(series[0]).toEqual({ date: '2026-08-19', views: 3 })
  })

  it('ignores rows outside the window', () => {
    const series = fillDailySeries([{ date: new Date('2026-01-01T00:00:00Z'), views: 999 }], 2, now)
    expect(series.every((p) => p.views === 0)).toBe(true)
  })

  it('defaults to the advertised window length', () => {
    expect(fillDailySeries([], undefined, now)).toHaveLength(VIEW_TREND_DAYS)
  })
})

import { describe, expect, it } from 'vitest'

import {
  articleCreditsForPlan,
  articleCreditCost,
  affordableArticleCount,
  nextArticleCreditMonth,
  PLAN_ARTICLE_CREDITS,
  TRIAL_ARTICLE_CREDITS,
} from '../../shared/utils/articleCredits'

describe('article allowance policy', () => {
  it.each([
    ['STANDARD', 1],
    ['HIGH', 2],
    ['ULTRA', 3],
    [undefined, 1],
    ['unknown', 1],
  ] as const)('prices %s at %s credits', (quality, expected) => {
    expect(articleCreditCost(quality)).toBe(expected)
  })

  it('counts whole affordable articles for the selected quality', () => {
    expect(affordableArticleCount(5, 'STANDARD')).toBe(5)
    expect(affordableArticleCount(5, 'HIGH')).toBe(2)
    expect(affordableArticleCount(5, 'ULTRA')).toBe(1)
    expect(affordableArticleCount(2, 'ULTRA')).toBe(0)
    expect(affordableArticleCount(-1, 'HIGH')).toBe(0)
  })
  it('keeps the trial and plan quantities explicit', () => {
    expect(TRIAL_ARTICLE_CREDITS).toBe(5)
    expect(PLAN_ARTICLE_CREDITS).toEqual({ PRO: 30, PREMIUM: 50 })
  })

  it('does not grant articles to plans outside the paid AI catalog', () => {
    expect(articleCreditsForPlan('PRO')).toBe(30)
    expect(articleCreditsForPlan('PREMIUM')).toBe(50)
    expect(articleCreditsForPlan('BASIC')).toBe(0)
    expect(articleCreditsForPlan(null)).toBe(0)
  })

  it('clamps monthly periods to the final day of shorter months', () => {
    expect(nextArticleCreditMonth(new Date('2027-01-31T14:30:00.000Z')).toISOString()).toBe('2027-02-28T14:30:00.000Z')
    expect(nextArticleCreditMonth(new Date('2028-01-31T14:30:00.000Z')).toISOString()).toBe('2028-02-29T14:30:00.000Z')
  })
})

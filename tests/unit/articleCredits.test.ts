import { describe, expect, it } from 'vitest'

import {
  articleCreditsForPlan,
  nextArticleCreditMonth,
  PLAN_ARTICLE_CREDITS,
  TRIAL_ARTICLE_CREDITS,
} from '../../shared/utils/articleCredits'

describe('article allowance policy', () => {
  it('keeps the trial and plan quantities explicit', () => {
    expect(TRIAL_ARTICLE_CREDITS).toBe(5)
    expect(PLAN_ARTICLE_CREDITS).toEqual({ PRO: 20, PREMIUM: 30 })
  })

  it('does not grant articles to plans outside the paid AI catalog', () => {
    expect(articleCreditsForPlan('PRO')).toBe(20)
    expect(articleCreditsForPlan('PREMIUM')).toBe(30)
    expect(articleCreditsForPlan('BASIC')).toBe(0)
    expect(articleCreditsForPlan(null)).toBe(0)
  })

  it('clamps monthly periods to the final day of shorter months', () => {
    expect(nextArticleCreditMonth(new Date('2027-01-31T14:30:00.000Z')).toISOString()).toBe('2027-02-28T14:30:00.000Z')
    expect(nextArticleCreditMonth(new Date('2028-01-31T14:30:00.000Z')).toISOString()).toBe('2028-02-29T14:30:00.000Z')
  })
})

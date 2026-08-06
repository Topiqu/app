import { describe, expect, it } from 'vitest'

import {
  billableMonthlyTotal,
  getAllowedFeatures,
  getDependents,
  getMissingDependencies,
  isAlaCartePlan,
  planFeatureSync,
} from '../../../server/utils/planFeatures'

describe('getAllowedFeatures', () => {
  it('BASIC unlocks nothing', () => {
    expect(getAllowedFeatures('BASIC')).toEqual({ AI: false, SENTIMENT: false, ARTICLE_CRONS: false })
  })

  it('PRO unlocks AI + ARTICLE_CRONS but not SENTIMENT', () => {
    expect(getAllowedFeatures('PRO')).toEqual({ AI: true, SENTIMENT: false, ARTICLE_CRONS: true })
  })

  it('PREMIUM and CUSTOM unlock everything', () => {
    expect(getAllowedFeatures('PREMIUM')).toEqual({ AI: true, SENTIMENT: true, ARTICLE_CRONS: true })
    expect(getAllowedFeatures('CUSTOM')).toEqual({ AI: true, SENTIMENT: true, ARTICLE_CRONS: true })
  })
})

describe('getMissingDependencies (AI prerequisite)', () => {
  it('SENTIMENT and ARTICLE_CRONS require active AI', () => {
    expect(getMissingDependencies('SENTIMENT', [])).toEqual(['AI'])
    expect(getMissingDependencies('ARTICLE_CRONS', [])).toEqual(['AI'])
  })

  it('is satisfied when AI is already active', () => {
    expect(getMissingDependencies('SENTIMENT', ['AI'])).toEqual([])
    expect(getMissingDependencies('ARTICLE_CRONS', ['AI'])).toEqual([])
  })

  it('AI itself has no dependencies', () => {
    expect(getMissingDependencies('AI', [])).toEqual([])
  })
})

describe('getDependents (cascade on disable)', () => {
  it('disabling AI cascades to SENTIMENT and ARTICLE_CRONS', () => {
    expect(getDependents('AI').sort()).toEqual(['ARTICLE_CRONS', 'SENTIMENT'])
  })

  it('leaf features cascade to nothing', () => {
    expect(getDependents('SENTIMENT')).toEqual([])
    expect(getDependents('ARTICLE_CRONS')).toEqual([])
  })
})

describe('billableMonthlyTotal (à-la-carte only)', () => {
  it('standard plans never bill features à la carte (included in plan)', () => {
    expect(billableMonthlyTotal('PRO', 'MONTHLY', [29, 19])).toBe(0)
    expect(billableMonthlyTotal('PREMIUM', 'MONTHLY', [29, 19, 19])).toBe(0)
    expect(billableMonthlyTotal('BASIC', 'MONTHLY', [])).toBe(0)
  })

  it('CUSTOM sums the billed feature prices', () => {
    expect(billableMonthlyTotal('CUSTOM', 'MONTHLY', [29, 19, 19])).toBe(67)
  })

  it('CUSTOM on PERMANENT billing is comped to 0', () => {
    expect(billableMonthlyTotal('CUSTOM', 'PERMANENT', [29, 19, 19])).toBe(0)
  })
})

describe('planFeatureSync (plan grant provisioning)', () => {
  it('provisions everything a fresh PREMIUM site is owed', () => {
    expect(planFeatureSync('PREMIUM', [])).toEqual({
      activate: ['AI', 'SENTIMENT', 'ARTICLE_CRONS'],
      deactivate: [],
    })
  })

  it('activates AI before its dependents', () => {
    const { activate } = planFeatureSync('PRO', [])
    expect(activate[0]).toBe('AI')
  })

  it('is a no-op once the plan is already fully provisioned', () => {
    expect(planFeatureSync('PRO', ['AI', 'ARTICLE_CRONS'])).toEqual({ activate: [], deactivate: [] })
  })

  it('revokes what a downgrade no longer covers', () => {
    expect(planFeatureSync('PRO', ['AI', 'SENTIMENT', 'ARTICLE_CRONS'])).toEqual({
      activate: [],
      deactivate: ['SENTIMENT'],
    })
    expect(planFeatureSync('BASIC', ['AI', 'SENTIMENT', 'ARTICLE_CRONS'])).toEqual({
      activate: [],
      deactivate: ['AI', 'SENTIMENT', 'ARTICLE_CRONS'],
    })
  })

  it('never leaves a dependent active without AI', () => {
    const { deactivate } = planFeatureSync('BASIC', ['AI', 'SENTIMENT'])
    expect(deactivate).toContain('AI')
    expect(deactivate).toContain('SENTIMENT')
  })

  it('leaves CUSTOM alone — it is à la carte, not plan-granted', () => {
    expect(planFeatureSync('CUSTOM', [])).toEqual({ activate: [], deactivate: [] })
    expect(planFeatureSync('CUSTOM', ['AI'])).toEqual({ activate: [], deactivate: [] })
  })
})

describe('isAlaCartePlan', () => {
  it('only CUSTOM is à la carte', () => {
    expect(isAlaCartePlan('CUSTOM')).toBe(true)
    expect(isAlaCartePlan('PRO')).toBe(false)
    expect(isAlaCartePlan('PREMIUM')).toBe(false)
    expect(isAlaCartePlan('BASIC')).toBe(false)
  })
})

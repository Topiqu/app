import { describe, expect, it } from 'vitest'

import {
  billableMonthlyTotal,
  getAllowedFeatures,
  getDependents,
  getMissingDependencies,
  isAlaCartePlan,
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

describe('isAlaCartePlan', () => {
  it('only CUSTOM is à la carte', () => {
    expect(isAlaCartePlan('CUSTOM')).toBe(true)
    expect(isAlaCartePlan('PRO')).toBe(false)
    expect(isAlaCartePlan('PREMIUM')).toBe(false)
    expect(isAlaCartePlan('BASIC')).toBe(false)
  })
})

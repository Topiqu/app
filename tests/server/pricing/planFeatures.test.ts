import { describe, expect, it, vi } from 'vitest'

import {
  annualFromMonthly,
  billableFeatureWhere,
  billableMonthlyTotal,
  syncAutoRelease,
  syncGenerationSchedule,
  syncSeoAutopilot,
  getAllowedFeatures,
  getDependents,
  getMissingDependencies,
  isCustomPlan,
  planFeatureSync,
  recalcFeatureBilling,
} from '../../../server/utils/planFeatures'

describe('getAllowedFeatures', () => {
  it('BASIC unlocks nothing', () => {
    expect(getAllowedFeatures('BASIC')).toEqual({
      AI: false,
      SENTIMENT: false,
      ARTICLE_CRONS: false,
      SEARCH_CONSOLE: false,
    })
  })

  it('PRO unlocks AI + ARTICLE_CRONS but not SENTIMENT', () => {
    expect(getAllowedFeatures('PRO')).toEqual({
      AI: true,
      SENTIMENT: false,
      ARTICLE_CRONS: true,
      SEARCH_CONSOLE: false,
    })
  })

  it('PREMIUM and CUSTOM unlock everything', () => {
    expect(getAllowedFeatures('PREMIUM')).toEqual({
      AI: true,
      SENTIMENT: true,
      ARTICLE_CRONS: true,
      SEARCH_CONSOLE: true,
    })
    expect(getAllowedFeatures('CUSTOM')).toEqual({
      AI: true,
      SENTIMENT: true,
      ARTICLE_CRONS: true,
      SEARCH_CONSOLE: true,
    })
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
      activate: ['AI', 'SENTIMENT', 'ARTICLE_CRONS', 'SEARCH_CONSOLE'],
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

describe('annualFromMonthly', () => {
  it('applies the 20 % annual discount', () => {
    expect(annualFromMonthly(100, 'ANNUAL')).toBe(960)
  })

  it('is a plain ×12 on monthly and permanent billing', () => {
    expect(annualFromMonthly(100, 'MONTHLY')).toBe(1200)
    expect(annualFromMonthly(0, 'PERMANENT')).toBe(0)
  })

  it('rounds rather than leaking fractional currency', () => {
    expect(Number.isInteger(annualFromMonthly(29, 'ANNUAL'))).toBe(true)
  })
})

describe('billableFeatureWhere', () => {
  const now = new Date('2026-08-07T00:00:00.000Z')

  // Plan-granted rows carry `billingLockedUntil = now` (the window is meaningless for an
  // included feature), so filtering on the window alone billed a PREMIUM→CUSTOM tenant
  // nothing for the three features they kept.
  it('bills a feature that is on, regardless of an expired lock window', () => {
    expect(billableFeatureWhere('cs1', now).OR).toContainEqual({ isActive: true })
  })

  it('still bills a switched-off feature inside its anti-gaming window', () => {
    expect(billableFeatureWhere('cs1', now).OR).toContainEqual({ billingLockedUntil: { gt: now } })
  })

  it('scopes to the tenant', () => {
    expect(billableFeatureWhere('cs1', now).clientSiteId).toBe('cs1')
  })
})

describe('syncAutoRelease', () => {
  const makeTx = () => ({ clientSite: { updateMany: vi.fn(async () => ({ count: 1 })) } })

  it('switches autoRelease off once scheduled generation is gone', async () => {
    const tx = makeTx()
    await syncAutoRelease(tx as any, 'cs1', ['AI'])

    expect(tx.clientSite.updateMany).toHaveBeenCalledWith({
      where: { id: 'cs1', autoRelease: true },
      data: { autoRelease: false },
    })
  })

  it('leaves autoRelease alone while ARTICLE_CRONS is active', async () => {
    const tx = makeTx()
    await syncAutoRelease(tx as any, 'cs1', ['AI', 'ARTICLE_CRONS'])

    expect(tx.clientSite.updateMany).not.toHaveBeenCalled()
  })

  it('clears it on a full revocation', async () => {
    const tx = makeTx()
    await syncAutoRelease(tx as any, 'cs1', [])

    expect(tx.clientSite.updateMany).toHaveBeenCalled()
  })
})

describe('syncGenerationSchedule', () => {
  const makeTx = () => ({ clientSite: { updateMany: vi.fn(async () => ({ count: 1 })) } })

  it('gives an enabled cron feature a useful daily default', async () => {
    const tx = makeTx()
    await syncGenerationSchedule(tx as any, 'cs1', ['AI', 'ARTICLE_CRONS'])

    expect(tx.clientSite.updateMany).toHaveBeenCalledWith({
      where: { id: 'cs1', generationFrequency: 'NONE' },
      data: { generationFrequency: 'DAILY' },
    })
  })

  it('turns the stored schedule off with the feature', async () => {
    const tx = makeTx()
    await syncGenerationSchedule(tx as any, 'cs1', ['AI'])

    expect(tx.clientSite.updateMany).toHaveBeenCalledWith({
      where: { id: 'cs1', generationFrequency: { not: 'NONE' } },
      data: { generationFrequency: 'NONE' },
    })
  })
})

describe('syncSeoAutopilot', () => {
  it('turns autopilot off when Search Console or AI becomes inactive', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    await syncSeoAutopilot({ searchConsoleConnection: { updateMany } } as any, 'cs1', ['SEARCH_CONSOLE'])
    expect(updateMany).toHaveBeenCalledWith({
      where: { clientSiteId: 'cs1', autopilotEnabled: true },
      data: { autopilotEnabled: false },
    })
  })

  it('keeps the opt-in when both required features remain active', async () => {
    const updateMany = vi.fn()
    await syncSeoAutopilot(
      { searchConsoleConnection: { updateMany } } as any,
      'cs1',
      ['AI', 'SEARCH_CONSOLE'],
    )
    expect(updateMany).not.toHaveBeenCalled()
  })
})

describe('recalcFeatureBilling', () => {
  const now = new Date('2026-08-07T00:00:00.000Z')

  const makeTx = (billed: Array<{ feature: { priceMonthly: number } }> = []) => ({
    clientFeature: { findMany: vi.fn(async () => billed) },
    clientSite: { updateMany: vi.fn(async () => ({ count: 1 })) },
  })

  it('bills a CUSTOM tenant for every feature still switched on', async () => {
    const tx = makeTx([{ feature: { priceMonthly: 20 } }, { feature: { priceMonthly: 9 } }])
    const result = await recalcFeatureBilling(tx as any, 'cs1', 'CUSTOM', 'MONTHLY', now)

    expect(result).toEqual({ monthlyPayment: 29, annualPayment: 348 })
    expect(tx.clientFeature.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: billableFeatureWhere('cs1', now) }),
    )
  })

  it('zeroes the stored price on a plan downgrade — the plan itself is the Stripe charge', async () => {
    const tx = makeTx([{ feature: { priceMonthly: 20 } }])
    const result = await recalcFeatureBilling(tx as any, 'cs1', 'BASIC', 'MONTHLY', now)

    expect(result).toEqual({ monthlyPayment: 0, annualPayment: 0 })
    expect(tx.clientFeature.findMany).not.toHaveBeenCalled()
    expect(tx.clientSite.updateMany).toHaveBeenCalledWith({
      where: { id: 'cs1' },
      data: { monthlyPayment: 0, annualPayment: 0 },
    })
  })

  it('comps a PERMANENT CUSTOM contract to zero', async () => {
    const tx = makeTx([{ feature: { priceMonthly: 20 } }])

    expect(await recalcFeatureBilling(tx as any, 'cs1', 'CUSTOM', 'PERMANENT', now)).toEqual({
      monthlyPayment: 0,
      annualPayment: 0,
    })
  })
})

describe('isCustomPlan', () => {
  it('only CUSTOM is à la carte', () => {
    expect(isCustomPlan('CUSTOM')).toBe(true)
    expect(isCustomPlan('PRO')).toBe(false)
    expect(isCustomPlan('PREMIUM')).toBe(false)
    expect(isCustomPlan('BASIC')).toBe(false)
  })
})

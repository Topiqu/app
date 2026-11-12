// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { hasAiPlan } from '../../shared/utils/plans'
import { articleQualityOf } from '../../shared/utils/articleQuality'
import { articleCreditCost } from '../../shared/utils/articleCredits'
import { poolOf, poolWalletSelect, spendableUnits } from '../../server/utils/billingAccount'

const findMany = vi.fn()
const refill = vi.fn()
const stock = vi.fn()
const hasDataForSeo = vi.fn()

const daily = {
  frequency: 'INTERVAL',
  timeZone: 'UTC',
  releaseHour: 16,
  releaseWindowStart: 0,
  releaseWindowEnd: 24,
  releaseDays: [1, 2, 3, 4, 5, 6, 7],
  intervalMinHours: 24,
  intervalMaxHours: 24,
}

const stubGlobals = () => {
  for (const [name, value] of Object.entries({
    defineMonitoredTask: (definition: unknown) => definition,
    prisma: { clientSite: { findMany } },
    activeFeatureFilter: (code: string) => ({ features: { some: { isActive: true, feature: { code } } } }),
    articleQualityOf,
    poolOf,
    spendableUnits,
    poolWalletSelect,
    articleCreditCost,
    hasAiPlan,
    hasDataForSeo,
    releaseScheduleOf: (site: { generationFrequency: string }) => (site.generationFrequency === 'NONE' ? null : daily),
    keywordPlanStock: stock,
    refillKeywordPlan: refill,
  }))
    vi.stubGlobal(name, value)
}

stubGlobals()
const { default: task } = await import('../../server/tasks/keyword-plan-refill')
const run = () => (task as unknown as { run: () => Promise<{ result: unknown }> }).run()

const site = (id: string, changes: Record<string, unknown> = {}) => ({
  id,
  plan: 'PRO',
  articleQuality: 'STANDARD',
  generationFrequency: 'INTERVAL',
  billingAccount: null,
  directBillingAccount: { wallet: { grants: [{ remaining: 5 }] } },
  ...changes,
})

describe('keyword-plan-refill task', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stubGlobals()
    hasDataForSeo.mockReturnValue(true)
    stock.mockReturnValue(14)
    refill.mockResolvedValue({ attempted: false })
    findMany.mockResolvedValue([])
  })
  afterEach(() => vi.unstubAllGlobals())

  it('does nothing and asks for nothing without DataForSEO', async () => {
    hasDataForSeo.mockReturnValue(false)
    await expect(run()).resolves.toEqual({ result: { checked: 0, attempted: 0, failed: 0 } })
    expect(findMany).not.toHaveBeenCalled()
  })

  it('looks only at live autopilot sites outside the one-day lease', async () => {
    await run()
    const { where } = findMany.mock.calls[0]![0]
    expect(where).toMatchObject({
      deletedAt: null,
      generationFrequency: { not: 'NONE' },
      features: { some: { isActive: true, feature: { code: 'ARTICLE_CRONS' } } },
    })
    expect(where.OR[0]).toEqual({ keywordPlanAttemptedAt: null })
    const lease = where.OR[1].keywordPlanAttemptedAt.lte as Date
    expect(Date.now() - lease.getTime()).toBeGreaterThanOrEqual(86_400_000)
  })

  it('asks each site for the stock its own rhythm needs', async () => {
    const row = site('a')
    findMany.mockResolvedValue([row])
    await run()
    expect(stock.mock.calls[0]![0]).toBeGreaterThanOrEqual(28)
    expect(refill).toHaveBeenCalledWith(row, 14, expect.any(Date))
  })

  it('leaves out a site that cannot write an article', async () => {
    findMany.mockResolvedValue([
      site('free', { plan: 'FREE' }),
      site('broke', { directBillingAccount: { wallet: { grants: [] } } }),
      site('no-wallet', { directBillingAccount: { wallet: null } }),
      site('ultra', { articleQuality: 'ULTRA', directBillingAccount: { wallet: { grants: [{ remaining: 2 }] } } }),
    ])
    await expect(run()).resolves.toEqual({ result: { checked: 0, attempted: 0, failed: 0 } })
    expect(refill).not.toHaveBeenCalled()
  })

  it('stops after five rebuilds, and the rest go next hour', async () => {
    findMany.mockResolvedValue(Array.from({ length: 8 }, (_, index) => site(`s${index}`)))
    refill.mockResolvedValue({ attempted: true })
    await expect(run()).resolves.toEqual({ result: { checked: 5, attempted: 5, failed: 0 } })
    expect(refill).toHaveBeenCalledTimes(5)
  })

  it('does not count a site that needed nothing towards that limit', async () => {
    findMany.mockResolvedValue(Array.from({ length: 8 }, (_, index) => site(`s${index}`)))
    await expect(run()).resolves.toEqual({ result: { checked: 8, attempted: 0, failed: 0 } })
  })

  it('carries on past a site that fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    findMany.mockResolvedValue([site('bad'), site('good')])
    refill.mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce({ attempted: true })
    await expect(run()).resolves.toEqual({ result: { checked: 2, attempted: 1, failed: 1 } })
  })
})

import { describe, expect, it } from 'vitest'

import { DEFAULT_RELEASE_SCHEDULE, type ReleaseSchedule } from '../../shared/utils/releaseSchedule'
import {
  articleCreditOverview,
  batchSlots,
  clearOfAutopilot,
  recommendedArticleQuality,
  recommendedAutopilotInterval,
} from '../../shared/utils/articleBatch'

const HOUR = 3_600_000
const now = new Date('2026-11-10T09:00:00.000Z')
const daily: ReleaseSchedule = { ...DEFAULT_RELEASE_SCHEDULE, frequency: 'DAILY' }

const overview = (plan: string, quality: 'STANDARD' | 'HIGH' | 'ULTRA' = 'STANDARD', available = 180, carried = 0) =>
  articleCreditOverview({ plan, quality, schedule: daily, available, carried, now })

describe('articleCreditOverview', () => {
  it('counts what the daily autopilot leaves unused', () => {
    const credits = overview('PREMIUM')
    expect(credits.autopilotPerMonth).toBeGreaterThanOrEqual(29)
    expect(credits.autopilotCredits).toBe(credits.autopilotPerMonth)
    expect(credits.monthlySurplus).toBe(100 - credits.autopilotCredits)
    expect(credits.free).toBe(180 - credits.autopilotCredits)
  })

  it('prices the autopilot at the selected quality, so a High PRO blog has no surplus', () => {
    const credits = overview('PRO', 'HIGH')
    expect(credits.autopilotCredits).toBe(credits.autopilotPerMonth * 2)
    expect(credits.monthlySurplus).toBe(0)
  })

  it('leaves every credit free when the autopilot is off', () => {
    const credits = articleCreditOverview({
      plan: 'PRO',
      quality: 'STANDARD',
      schedule: null,
      available: 40,
      carried: 0,
      now,
    })
    expect(credits).toMatchObject({ autopilotPerMonth: 0, autopilotCredits: 0, free: 40, monthlySurplus: 50 })
  })

  it('reports the rollover cap only once the carried credits reach it', () => {
    expect(overview('PRO', 'STANDARD', 150, 99).atRolloverCap).toBe(false)
    expect(overview('PRO', 'STANDARD', 150, 100).atRolloverCap).toBe(true)
    expect(overview('BASIC', 'STANDARD', 0, 0).atRolloverCap).toBe(false)
  })
})

describe('recommendedArticleQuality', () => {
  it('recommends the best quality the allowance sustains', () => {
    expect(recommendedArticleQuality(overview('PREMIUM'), 'STANDARD')).toBe('ULTRA')
    expect(recommendedArticleQuality(overview('PRO'), 'STANDARD')).toBeNull()
  })

  it('never recommends a step down', () => {
    expect(recommendedArticleQuality(overview('PRO', 'ULTRA'), 'ULTRA')).toBeNull()
  })

  it('recommends nothing without an autopilot rhythm', () => {
    const credits = articleCreditOverview({
      plan: 'PREMIUM',
      quality: 'STANDARD',
      schedule: null,
      available: 40,
      carried: 0,
      now,
    })
    expect(recommendedArticleQuality(credits, 'STANDARD')).toBeNull()
  })
})

describe('recommendedAutopilotInterval', () => {
  it('spends the allowance at a rhythm that fits it', () => {
    const interval = recommendedAutopilotInterval(overview('PRO'))
    expect(interval).toEqual({ intervalMinHours: 12, intervalMaxHours: 18, perMonth: 48 })
  })

  it('caps the recommendation at two articles a day', () => {
    expect(recommendedAutopilotInterval(overview('PREMIUM'))).toEqual({
      intervalMinHours: 10,
      intervalMaxHours: 14,
      perMonth: 60,
    })
  })

  it('stays quiet when the rhythm already spends the allowance', () => {
    expect(recommendedAutopilotInterval(overview('PRO', 'HIGH'))).toBeNull()
    expect(recommendedAutopilotInterval(overview('BASIC'))).toBeNull()
  })
})

describe('batchSlots', () => {
  const settings = { ...DEFAULT_RELEASE_SCHEDULE, releaseWindowStart: 0, releaseWindowEnd: 24 }

  it('starts right away and keeps the pace', () => {
    const slots = batchSlots(settings, 48, 4, now, () => 0)
    expect(slots).toHaveLength(4)
    expect(slots[0]!.getTime() - now.getTime()).toBeLessThanOrEqual(60_000)
    for (let index = 1; index < slots.length; index++)
      expect(slots[index]!.getTime() - slots[index - 1]!.getTime()).toBeGreaterThanOrEqual(48 * HOUR - 60_000)
  })

  it('lands only inside the site window and on its days', () => {
    const slots = batchSlots(
      {
        ...DEFAULT_RELEASE_SCHEDULE,
        timeZone: 'UTC',
        releaseDays: [1, 3],
        releaseWindowStart: 8,
        releaseWindowEnd: 10,
      },
      24,
      6,
      now,
      () => 0.5,
    )
    for (const slot of slots) {
      expect([1, 3]).toContain(slot.getUTCDay())
      expect(slot.getUTCHours()).toBeGreaterThanOrEqual(8)
      expect(slot.getUTCHours()).toBeLessThan(10)
    }
  })
})

describe('clearOfAutopilot', () => {
  const slot = new Date('2026-11-10T12:00:00.000Z')

  it('steps past an autopilot release close by', () => {
    const autopilot = new Date('2026-11-10T13:00:00.000Z')
    expect(clearOfAutopilot(slot, autopilot)).toEqual(new Date('2026-11-10T15:00:00.000Z'))
  })

  it('leaves a distant slot alone', () => {
    expect(clearOfAutopilot(slot, new Date('2026-11-11T12:00:00.000Z'))).toBe(slot)
    expect(clearOfAutopilot(slot, null)).toBe(slot)
  })
})

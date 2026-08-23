import { describe, expect, it } from 'vitest'

import { generationDueBefore, type GenerationPeriod } from '../../../server/utils/generationSchedule'

const isDue = (now: string, lastGeneratedAt: string, period: GenerationPeriod) =>
  new Date(lastGeneratedAt) <= generationDueBefore(new Date(now), period)

// The cron fires at 15:00 UTC; generating takes a couple of minutes, so lastGeneratedAt always
// lands just after the firing time. A strict period made the next firing miss by that margin.
const LAST_RUN = '2026-08-06T15:02:18Z'

describe('generationDueBefore', () => {
  it('a DAILY tenant is due at the next firing despite the run finishing after it', () => {
    expect(isDue('2026-08-07T15:00:00Z', LAST_RUN, 'DAILY')).toBe(true)
  })

  it('does not let a DAILY tenant run twice on the same day', () => {
    expect(isDue('2026-08-06T16:00:00Z', LAST_RUN, 'DAILY')).toBe(false)
    expect(isDue('2026-08-06T23:59:00Z', LAST_RUN, 'DAILY')).toBe(false)
  })

  // Pins the slack: widening it further would start allowing genuinely early runs.
  it('opens the DAILY window exactly 23h after the last run', () => {
    expect(isDue('2026-08-07T14:02:18Z', LAST_RUN, 'DAILY')).toBe(true)
    expect(isDue('2026-08-07T14:02:17Z', LAST_RUN, 'DAILY')).toBe(false)
  })

  it('holds a WEEKLY tenant to its day-7 slot', () => {
    expect(isDue('2026-08-12T15:00:00Z', LAST_RUN, 'WEEKLY')).toBe(false)
    expect(isDue('2026-08-13T15:00:00Z', LAST_RUN, 'WEEKLY')).toBe(true)
  })
})

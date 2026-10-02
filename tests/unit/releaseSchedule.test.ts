import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RELEASE_SCHEDULE,
  FIXED_JITTER_MINUTES,
  MIN_INTERVAL_HOURS,
  nextRelease,
  releaseForecast,
  releaseScheduleError,
  seededRandom,
  upcomingReleases,
  type ReleaseSchedule,
} from '~~/shared/utils/releaseSchedule'

const schedule = (overrides: Partial<ReleaseSchedule> = {}): ReleaseSchedule => ({
  ...DEFAULT_RELEASE_SCHEDULE,
  frequency: 'DAILY',
  ...overrides,
})

const local = (date: Date, timeZone = 'Europe/Prague') => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )
  return { weekday: parts.weekday!, minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}

const minRandom = () => 0
const maxRandom = () => 0.999999

describe('fixed releases', () => {
  it('lands within the jitter around the local release hour', () => {
    const now = new Date('2026-10-05T06:00:00Z') // Monday 08:00 in Prague
    for (const random of [minRandom, maxRandom, seededRandom(3)]) {
      const slot = nextRelease(schedule({ releaseHour: 16 }), { now, random })!
      expect(Math.abs(local(slot).minutes - 16 * 60)).toBeLessThanOrEqual(FIXED_JITTER_MINUTES)
      expect(local(slot).weekday).toBe('Mon')
    }
  })

  it('moves to the next allowed day once today’s slot has passed', () => {
    const now = new Date('2026-10-09T18:00:00Z') // Friday 20:00 in Prague
    const slot = nextRelease(schedule({ releaseDays: [1, 2, 3, 4, 5] }), { now, random: minRandom })!
    expect(local(slot).weekday).toBe('Mon')
  })

  it('keeps a weekly rhythm from the previous slot', () => {
    const previous = new Date('2026-10-08T14:00:00Z') // Thursday
    const slot = nextRelease(schedule({ frequency: 'WEEKLY' }), { previous, now: previous, random: minRandom })!
    expect(local(slot).weekday).toBe('Thu')
    expect(slot.getTime() - previous.getTime()).toBeGreaterThan(6 * 24 * 3600_000)
  })

  it('keeps the local hour across a DST change', () => {
    const now = new Date('2026-10-24T20:00:00Z') // Saturday night before CEST → CET
    const slot = nextRelease(schedule({ releaseHour: 9 }), { now, random: () => 0.5 })!
    expect(local(slot).weekday).toBe('Sun')
    expect(local(slot).minutes).toBe(9 * 60)
  })

  it('uses the tenant’s own time zone', () => {
    const now = new Date('2026-10-05T12:00:00Z')
    const slot = nextRelease(schedule({ releaseHour: 9, timeZone: 'America/New_York' }), { now, random: () => 0.5 })!
    expect(local(slot, 'America/New_York').minutes).toBe(9 * 60)
  })
})

describe('interval releases', () => {
  const interval = (overrides: Partial<ReleaseSchedule> = {}) =>
    schedule({ frequency: 'INTERVAL', intervalMinHours: 24, intervalMaxHours: 72, ...overrides })

  it('never releases sooner than the minimum gap or outside the window and allowed days', () => {
    const rules = interval({ releaseWindowStart: 8, releaseWindowEnd: 20, releaseDays: [1, 2, 3, 4, 5] })
    const slots = upcomingReleases(rules, {
      now: new Date('2026-10-05T06:00:00Z'),
      count: 200,
      random: seededRandom(9),
    })

    expect(slots).toHaveLength(200)
    for (const [i, slot] of slots.entries()) {
      const { weekday, minutes } = local(slot)
      expect(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']).toContain(weekday)
      expect(minutes).toBeGreaterThanOrEqual(8 * 60)
      expect(minutes).toBeLessThan(20 * 60)
      if (i) expect(slot.getTime() - slots[i - 1]!.getTime()).toBeGreaterThanOrEqual(24 * 3600_000)
    }
  })

  it('varies the time of day', () => {
    const slots = upcomingReleases(interval(), {
      now: new Date('2026-10-05T06:00:00Z'),
      count: 30,
      random: seededRandom(4),
    })
    expect(new Set(slots.map((slot) => Math.floor(local(slot).minutes / 120))).size).toBeGreaterThan(3)
  })

  it('keeps a gap that falls inside the window as drawn', () => {
    const previous = new Date('2026-10-05T08:00:00Z') // Monday 10:00 in Prague
    const slot = nextRelease(interval({ intervalMinHours: 6, intervalMaxHours: 6 }), { previous, now: previous })!
    expect(slot.getTime() - previous.getTime()).toBe(6 * 3600_000)
  })

  it('starts from now when the previous slot is long gone', () => {
    const now = new Date('2026-10-05T08:00:00Z')
    const slot = nextRelease(interval(), { previous: new Date('2026-09-01T08:00:00Z'), now, random: minRandom })!
    expect(slot > now).toBe(true)
  })
})

describe('releaseScheduleError', () => {
  it('accepts the defaults', () => {
    expect(releaseScheduleError(schedule())).toBeNull()
  })

  it.each([
    [{ timeZone: 'Mars/Olympus' }, 'timeZone'],
    [{ releaseHour: 24 }, 'releaseHour'],
    [{ releaseWindowStart: 20, releaseWindowEnd: 8 }, 'releaseWindow'],
    [{ releaseDays: [] }, 'releaseDays'],
    [{ releaseDays: [1, 1] }, 'releaseDays'],
    [{ intervalMinHours: MIN_INTERVAL_HOURS - 1 }, 'intervalMinHours'],
    [{ intervalMinHours: 48, intervalMaxHours: 24 }, 'intervalMaxHours'],
  ])('rejects %o', (overrides, field) => {
    expect(releaseScheduleError(schedule(overrides as Partial<ReleaseSchedule>))).toBe(field)
  })
})

describe('releaseForecast', () => {
  it('counts a month of daily releases and the slot the credits last until', () => {
    const now = new Date('2026-10-05T06:00:00Z')
    const forecast = releaseForecast(schedule(), 5, now)
    expect(forecast.perMonth).toBeGreaterThanOrEqual(29)
    expect(forecast.perMonth).toBeLessThanOrEqual(31)
    expect(forecast.creditsLastUntil!.getTime() - now.getTime()).toBeLessThan(6 * 24 * 3600_000)
  })

  it('has no end date without credits', () => {
    expect(releaseForecast(schedule(), 0).creditsLastUntil).toBeNull()
  })
})

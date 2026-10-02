import { CalendarDateTime, fromDate, toZoned, type ZonedDateTime } from '@internationalized/date'

export type ReleaseFrequency = 'DAILY' | 'WEEKLY' | 'INTERVAL'

export interface ReleaseSchedule {
  frequency: ReleaseFrequency
  timeZone: string
  /** Local hour of a DAILY / WEEKLY release. */
  releaseHour: number
  /** INTERVAL releases land inside [start, end) local hours. */
  releaseWindowStart: number
  releaseWindowEnd: number
  /** ISO weekdays, 1 = Monday … 7 = Sunday. */
  releaseDays: number[]
  intervalMinHours: number
  intervalMaxHours: number
}

export const DEFAULT_TIME_ZONE = 'Europe/Prague'
export const MIN_INTERVAL_HOURS = 6
export const MAX_INTERVAL_HOURS = 4 * 7 * 24
/** Fixed releases drift up to this many minutes either way, so no tenant publishes on the dot. */
export const FIXED_JITTER_MINUTES = 30

export const DEFAULT_RELEASE_SCHEDULE: Omit<ReleaseSchedule, 'frequency'> = {
  timeZone: DEFAULT_TIME_ZONE,
  releaseHour: 16,
  releaseWindowStart: 7,
  releaseWindowEnd: 21,
  releaseDays: [1, 2, 3, 4, 5, 6, 7],
  intervalMinHours: 24,
  intervalMaxHours: 72,
}

export type ReleaseScheduleSettings = Omit<ReleaseSchedule, 'frequency'>

export const releaseScheduleSettings = (site?: Partial<ReleaseScheduleSettings> | null): ReleaseScheduleSettings => ({
  timeZone: site?.timeZone ?? DEFAULT_RELEASE_SCHEDULE.timeZone,
  releaseHour: site?.releaseHour ?? DEFAULT_RELEASE_SCHEDULE.releaseHour,
  releaseWindowStart: site?.releaseWindowStart ?? DEFAULT_RELEASE_SCHEDULE.releaseWindowStart,
  releaseWindowEnd: site?.releaseWindowEnd ?? DEFAULT_RELEASE_SCHEDULE.releaseWindowEnd,
  releaseDays: site?.releaseDays?.length ? [...site.releaseDays] : [...DEFAULT_RELEASE_SCHEDULE.releaseDays],
  intervalMinHours: site?.intervalMinHours ?? DEFAULT_RELEASE_SCHEDULE.intervalMinHours,
  intervalMaxHours: site?.intervalMaxHours ?? DEFAULT_RELEASE_SCHEDULE.intervalMaxHours,
})

const HOUR_MS = 60 * 60 * 1000
const LOOKAHEAD_DAYS = 21

export const isTimeZone = (value: string) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return Boolean(value)
  } catch {
    return false
  }
}

/** First broken rule of a schedule, or null. The PATCH endpoint and the settings form share it. */
export const releaseScheduleError = (schedule: ReleaseSchedule) => {
  const { releaseHour, releaseWindowStart: start, releaseWindowEnd: end, releaseDays: days } = schedule
  const int = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max

  if (!isTimeZone(schedule.timeZone)) return 'timeZone'
  if (!int(releaseHour, 0, 23)) return 'releaseHour'
  if (!int(start, 0, 23) || !int(end, 1, 24) || start >= end) return 'releaseWindow'
  if (!days.length || days.some((day) => !int(day, 1, 7)) || new Set(days).size !== days.length) return 'releaseDays'
  if (!int(schedule.intervalMinHours, MIN_INTERVAL_HOURS, MAX_INTERVAL_HOURS)) return 'intervalMinHours'
  if (!int(schedule.intervalMaxHours, schedule.intervalMinHours, MAX_INTERVAL_HOURS)) return 'intervalMaxHours'
  return null
}

const isoWeekday = (day: ZonedDateTime) => new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay() || 7

// Wall-clock arithmetic first, zone last: adding minutes to a zoned midnight would be off by an hour
// on DST days. 'later' moves a local time skipped by the spring jump past the gap.
const atLocalMinute = (day: ZonedDateTime, minuteOfDay: number, timeZone: string) =>
  toZoned(new CalendarDateTime(day.year, day.month, day.day).add({ minutes: minuteOfDay }), timeZone, 'later')

const randomInt = (min: number, max: number, random: () => number) => min + Math.floor(random() * (max - min + 1))

const nextFixed = (schedule: ReleaseSchedule, previous: Date | null, now: Date, random: () => number) => {
  const days = new Set(schedule.releaseDays)
  const period = schedule.frequency === 'WEEKLY' ? 7 : 1
  let day = fromDate(previous ?? now, schedule.timeZone).add({ days: previous ? period : 0 })

  for (let i = 0; i < LOOKAHEAD_DAYS; i++, day = day.add({ days: 1 })) {
    if (!days.has(isoWeekday(day))) continue
    const jitter = randomInt(-FIXED_JITTER_MINUTES, FIXED_JITTER_MINUTES, random)
    const slot = atLocalMinute(day, schedule.releaseHour * 60 + jitter, schedule.timeZone).toDate()
    if (slot > now) return slot
  }
  return null
}

const nextInterval = (schedule: ReleaseSchedule, previous: Date | null, now: Date, random: () => number) => {
  const days = new Set(schedule.releaseDays)
  const gap = randomInt(schedule.intervalMinHours * 60, schedule.intervalMaxHours * 60, random)
  const earliest = new Date(Math.max((previous ?? now).getTime() + gap * 60_000, now.getTime() + 60_000))
  const start = schedule.releaseWindowStart * 60
  const end = schedule.releaseWindowEnd * 60

  let day = fromDate(earliest, schedule.timeZone)
  for (let i = 0; i < LOOKAHEAD_DAYS; i++, day = day.add({ days: 1 })) {
    if (!days.has(isoWeekday(day))) continue
    const opens = atLocalMinute(day, start, schedule.timeZone).toDate()
    const closes = atLocalMinute(day, end, schedule.timeZone).toDate()
    if (earliest >= closes) continue
    // Inside the window the gap is kept as drawn; a gap that fell outside it moves to a random
    // minute of the next open window, so nights and closed days never collect releases.
    if (earliest >= opens) return new Date(Math.floor(earliest.getTime() / 60_000) * 60_000)
    return new Date(opens.getTime() + randomInt(0, end - start - 1, random) * 60_000)
  }
  return null
}

/**
 * The release slot after `previous` (or the first one from `now`). Always in the future; null only
 * when no allowed day exists in the lookahead, which a valid schedule cannot produce.
 */
export const nextRelease = (
  schedule: ReleaseSchedule,
  {
    previous = null,
    now = new Date(),
    random = Math.random,
  }: { previous?: Date | null; now?: Date; random?: () => number },
) =>
  schedule.frequency === 'INTERVAL'
    ? nextInterval(schedule, previous, now, random)
    : nextFixed(schedule, previous, now, random)

/** Deterministic PRNG (mulberry32), so a settings preview does not reshuffle on every render. */
export const seededRandom = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export const upcomingReleases = (
  schedule: ReleaseSchedule,
  {
    now = new Date(),
    until,
    count = 100,
    random = Math.random,
  }: { now?: Date; until?: Date; count?: number; random?: () => number },
) => {
  const slots: Date[] = []
  let previous: Date | null = null
  while (slots.length < count) {
    const slot = nextRelease(schedule, { previous, now: previous ?? now, random })
    if (!slot || (until && slot > until)) break
    slots.push(slot)
    previous = slot
  }
  return slots
}

/** Expected releases in the next 30 days and the slot the remaining credits run out at. */
export const releaseForecast = (schedule: ReleaseSchedule, credits: number | null, now = new Date()) => {
  const random = seededRandom(17)
  const monthly = upcomingReleases(schedule, { now, until: new Date(now.getTime() + 30 * 24 * HOUR_MS), random })
  const horizon = upcomingReleases(schedule, { now, count: Math.max(0, credits ?? 0) + 1, random: seededRandom(17) })
  return {
    perMonth: monthly.length,
    // The slot of the last affordable article; null when there are no credits to spend.
    creditsLastUntil: credits && credits > 0 ? (horizon[credits - 1] ?? null) : null,
  }
}

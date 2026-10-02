import type { GenerationFrequency } from '~~/generated/zenstack/models'

import { DEFAULT_RELEASE_SCHEDULE, nextRelease, type ReleaseSchedule } from '~~/shared/utils/releaseSchedule'

/** Generation starts this long before its slot, so review and media checks finish before release. */
export const GENERATION_LEAD_MS = 3 * 60 * 60 * 1000

export const RELEASE_SCHEDULE_FIELDS = [
  'generationFrequency',
  'timeZone',
  'releaseHour',
  'releaseWindowStart',
  'releaseWindowEnd',
  'releaseDays',
  'intervalMinHours',
  'intervalMaxHours',
] as const

export type ScheduleRow = {
  generationFrequency: GenerationFrequency
  timeZone: string
  releaseHour: number
  releaseWindowStart: number
  releaseWindowEnd: number
  releaseDays: number[] | null
  intervalMinHours: number
  intervalMaxHours: number
}

export const releaseScheduleOf = (site: ScheduleRow): ReleaseSchedule | null =>
  site.generationFrequency === 'NONE'
    ? null
    : {
        frequency: site.generationFrequency,
        timeZone: site.timeZone,
        releaseHour: site.releaseHour,
        releaseWindowStart: site.releaseWindowStart,
        releaseWindowEnd: site.releaseWindowEnd,
        releaseDays: site.releaseDays?.length ? site.releaseDays : DEFAULT_RELEASE_SCHEDULE.releaseDays,
        intervalMinHours: site.intervalMinHours,
        intervalMaxHours: site.intervalMaxHours,
      }

export type ScheduledSite = ScheduleRow & { nextReleaseAt: Date | null; lastGeneratedAt: Date | null }

export type RunPlan =
  { action: 'off' } | { action: 'wait'; slot: Date } | { action: 'generate'; slot: Date; following: Date | null }

/**
 * What the cron does with a site now. A site without a slot (just migrated, or re-enabled) gets one
 * measured from its last generation, so turning the scheduler on never fires an extra article.
 * `following` is claimed before generating; a failed run forfeits its slot rather than retrying
 * every 15 minutes on our AI bill.
 */
export const planRun = (site: ScheduledSite, now: Date, random: () => number = Math.random): RunPlan => {
  const schedule = releaseScheduleOf(site)
  if (!schedule) return { action: 'off' }

  const slot = site.nextReleaseAt ?? nextRelease(schedule, { previous: site.lastGeneratedAt, now, random })
  if (!slot) return { action: 'off' }
  if (slot.getTime() - now.getTime() > GENERATION_LEAD_MS) return { action: 'wait', slot }
  return { action: 'generate', slot, following: nextRelease(schedule, { previous: slot, now, random }) }
}

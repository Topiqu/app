import { ARTICLE_QUALITY_LEVELS, type ArticleQuality } from './articleQuality'
import { articleCreditCost, articleCreditsForPlan, articleRolloverCap } from './articleCredits'
import {
  MIN_INTERVAL_HOURS,
  nextRelease,
  releaseForecast,
  type ReleaseSchedule,
  type ReleaseScheduleSettings,
} from './releaseSchedule'

const HOUR_MS = 60 * 60 * 1000
const MONTH_HOURS = 30 * 24

/** The keyword plan holds at most this many assessed topics, so a larger batch would only add weaker ones. */
export const MAX_BATCH_ITEMS = 30
export const BATCH_PACE_HOURS = [12, 24, 48, 84, 168] as const
export type BatchPaceHours = (typeof BATCH_PACE_HOURS)[number]
export const DEFAULT_BATCH_PACE_HOURS: BatchPaceHours = 48
/** At this pace or faster the screen warns about the site's publishing rhythm. */
export const FAST_BATCH_PACE_HOURS = 24
const AUTOPILOT_GAP_MS = 2 * HOUR_MS
const RECOMMENDED_MIN_GAP_HOURS = 12

export type ArticleBatchProposalItem = {
  id: string
  topic: string
  /** The plan's one-sentence explanation or the AI's, in the blog language. */
  reason: string | null
  keyword: string | null
  volume: number | null
  instructions: string | null
  keywordClusterId: string | null
  /** Selected from the start. A weaker topic stays listed, and the client opts in. */
  recommended: boolean
}

export const articleCreditOverview = (input: {
  plan: unknown
  quality: ArticleQuality
  schedule: ReleaseSchedule | null
  available: number
  carried: number
  /** Credits a running plan will still take. */
  committed?: number
  now?: Date
}) => {
  const cost = articleCreditCost(input.quality)
  const autopilotPerMonth = input.schedule
    ? releaseForecast(input.schedule, null, input.now, input.quality).perMonth
    : 0
  const autopilotCredits = autopilotPerMonth * cost
  const monthlyAllowance = articleCreditsForPlan(input.plan)
  const rolloverCap = articleRolloverCap(input.plan)
  return {
    available: input.available,
    cost,
    monthlyAllowance,
    autopilotPerMonth,
    autopilotCredits,
    monthlySurplus: Math.max(0, monthlyAllowance - autopilotCredits),
    // Credits the next month of autopilot does not need. An estimate: interval rhythms are random.
    free: Math.max(0, input.available - autopilotCredits - (input.committed ?? 0)),
    // Past the cap unused allowance lapses at the end of the period.
    atRolloverCap: rolloverCap > 0 && input.carried >= rolloverCap,
  }
}

export type ArticleCreditOverview = ReturnType<typeof articleCreditOverview>

/** The best quality the monthly allowance can sustain at the current rhythm, when above the current one. */
export const recommendedArticleQuality = (overview: ArticleCreditOverview, quality: ArticleQuality) => {
  if (!overview.autopilotPerMonth) return null
  const best = [...ARTICLE_QUALITY_LEVELS]
    .reverse()
    .find((level) => articleCreditCost(level) * overview.autopilotPerMonth <= overview.monthlyAllowance)
  return best && articleCreditCost(best) > articleCreditCost(quality) ? best : null
}

/** The rhythm that spends the monthly allowance, capped so a blog never gets more than two articles a day. */
export const recommendedAutopilotInterval = (overview: ArticleCreditOverview) => {
  const articles = Math.floor(overview.monthlyAllowance / overview.cost)
  if (!articles) return null
  const gap = Math.max(RECOMMENDED_MIN_GAP_HOURS, Math.ceil(MONTH_HOURS / articles))
  const perMonth = Math.floor(MONTH_HOURS / gap)
  if (perMonth <= overview.autopilotPerMonth) return null
  return {
    intervalMinHours: Math.max(MIN_INTERVAL_HOURS, Math.round(gap * 0.8)),
    intervalMaxHours: Math.round(gap * 1.2),
    perMonth,
  }
}

/** Release slots of a batch inside the site's own window and days. The first one is as soon as the window allows. */
export const batchSlots = (
  settings: ReleaseScheduleSettings,
  paceHours: number,
  count: number,
  now = new Date(),
  random: () => number = Math.random,
) => {
  const schedule: ReleaseSchedule = {
    ...settings,
    frequency: 'INTERVAL',
    intervalMinHours: paceHours,
    intervalMaxHours: Math.round(paceHours * 1.25),
  }
  const slots: Date[] = []
  let previous = new Date(now.getTime() - paceHours * HOUR_MS)
  for (let index = 0; index < count; index++) {
    const slot =
      nextRelease(schedule, { previous, now: index ? previous : now, random }) ??
      new Date(previous.getTime() + paceHours * HOUR_MS)
    slots.push(slot)
    previous = slot
  }
  return slots
}

/** Two articles minutes apart read as a burst, so a batch article steps past the autopilot's next slot. */
export const clearOfAutopilot = (slot: Date, autopilotSlot: Date | null | undefined) =>
  autopilotSlot && Math.abs(slot.getTime() - autopilotSlot.getTime()) < AUTOPILOT_GAP_MS
    ? new Date(autopilotSlot.getTime() + AUTOPILOT_GAP_MS)
    : slot

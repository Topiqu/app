const PERIOD_MS = {
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
} as const

export type GenerationPeriod = keyof typeof PERIOD_MS

// `lastGeneratedAt` records when generation *finished*, minutes after the fixed-time cron fired,
// so measuring a whole period back from the next firing always falls short by that run duration —
// which silently turned DAILY into every-other-day. One firing per day, so slack cannot double-run.
const SLACK_MS = 60 * 60 * 1000

export const generationDueBefore = (now: Date, period: GenerationPeriod): Date =>
  new Date(now.getTime() - PERIOD_MS[period] + SLACK_MS)

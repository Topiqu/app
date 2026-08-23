import type { AIInvolvement } from '@prisma/client'

export const VIEW_TREND_DAYS = 30

/** UTC day keys, oldest first — the view log buckets on a DATE column, which is UTC too. */
export const lastDays = (count: number, now = new Date()) => {
  const today = new Date(now)
  today.setUTCHours(0, 0, 0, 0)

  return Array.from({ length: count }, (_, i) => {
    const day = new Date(today)
    day.setUTCDate(day.getUTCDate() - (count - 1 - i))
    return day.toISOString().slice(0, 10)
  })
}

interface EngagementInput {
  views: number
  _count: { reactions: number; comments: number; pollResults: number; shares: number }
}

/**
 * Site-wide ratio, not the mean of per-article ratios: averaging ratios lets an article with one
 * view and three comments contribute 300% and outweigh a thousand-view piece. The old formula did
 * that, which is why the client had to clamp the displayed result at 100%.
 */
export const engagementRate = (articles: EngagementInput[]) => {
  const views = articles.reduce((sum, a) => sum + a.views, 0)
  if (views <= 0) return 0

  const interactions = articles.reduce(
    (sum, a) => sum + a._count.reactions + a._count.comments + a._count.shares + a._count.pollResults,
    0,
  )

  return interactions / views
}

/**
 * Share of readership carried by the three best articles. A blog living off one viral piece and
 * one with an even spread report the same total but are not the same business.
 */
export const topThreeShare = (viewCounts: number[]) => {
  const total = viewCounts.reduce((sum, v) => sum + v, 0)
  if (total <= 0) return 0

  const top = [...viewCounts].sort((a, b) => b - a).slice(0, 3)
  return top.reduce((sum, v) => sum + v, 0) / total
}

/** groupBy skips absent variants; the client needs all three to size the bar. */
export const involvementCounts = (rows: { aiInvolvement: AIInvolvement; _count: { _all: number } }[]) => {
  const counts: Record<AIInvolvement, number> = { NONE: 0, ASSIST: 0, FULL: 0 }
  rows.forEach((row) => {
    counts[row.aiInvolvement] = row._count._all
  })
  return counts
}

/** Every day in the window, not just the ones with a row — a sparse axis fakes a dense trend. */
export const fillDailySeries = (rows: { date: Date; views: number | bigint }[], days = VIEW_TREND_DAYS, now?: Date) => {
  const byDay = new Map(rows.map((row) => [row.date.toISOString().slice(0, 10), Number(row.views) || 0]))
  return lastDays(days, now).map((date) => ({ date, views: byDay.get(date) ?? 0 }))
}

import type { ClientPlan } from '~~/generated/zenstack/models'

import { z } from 'zod'

import { insightSchema } from './ai/insight'
import { activeFeatureFilter } from './planFeatures'

export const communitySiteWhere = () => ({
  deletedAt: null,
  plan: { in: ['PREMIUM', 'CUSTOM'] as ClientPlan[] },
  AND: [activeFeatureFilter('AI'), activeFeatureFilter('SENTIMENT')],
})

const unit = z.number().min(0).max(1)
const sentimentSchema = z.object({
  score: z.number().min(-1).max(1),
  toxicity: unit.optional(),
  helpfulness: unit.optional(),
  sarcasm: unit.optional(),
  point: z.string().trim().max(75).optional(),
  emotions: z
    .object({
      joy: unit.optional(),
      anger: unit.optional(),
      sadness: unit.optional(),
      fear: unit.optional(),
      surprise: unit.optional(),
    })
    .optional(),
})

export const communityAverages = (values: readonly unknown[]) => {
  const sentiments = values.flatMap((value) => {
    const parsed = sentimentSchema.safeParse(value)
    return parsed.success ? [parsed.data] : []
  })
  const sum = { score: 0, toxicity: 0, helpfulness: 0, sarcasm: 0 }
  const emotions = { joy: 0, anger: 0, sadness: 0, fear: 0, surprise: 0 }
  const points = new Map<string, number>()
  for (const item of sentiments) {
    sum.score += item.score
    sum.toxicity += item.toxicity ?? 0
    sum.helpfulness += item.helpfulness ?? 0
    sum.sarcasm += item.sarcasm ?? 0
    if (item.point) points.set(item.point, (points.get(item.point) ?? 0) + 1)
    for (const emotion of Object.keys(emotions) as (keyof typeof emotions)[])
      emotions[emotion] += item.emotions?.[emotion] ?? 0
  }
  const count = sentiments.length
  const topEmotion = Object.entries(emotions).sort((left, right) => right[1] - left[1])[0]
  return {
    count,
    avgScore: count ? sum.score / count : 0,
    toxicity: count ? sum.toxicity / count : 0,
    helpfulness: count ? sum.helpfulness / count : 0,
    sarcasm: count ? sum.sarcasm / count : 0,
    topEmotion: topEmotion && topEmotion[1] > 0 ? topEmotion[0] : null,
    topPoints: [...points.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 15)
      .map(([point]) => point),
  }
}

export const communityTrend = (current: number, previous?: number) =>
  previous === undefined ? undefined : current - previous > 0.1 ? 'up' : current - previous < -0.1 ? 'down' : 'stable'

const storedInsightSchema = insightSchema.extend({
  topPoints: z.array(z.string().max(75)).max(15).default([]),
  trend: z.enum(['up', 'down', 'stable']).optional(),
  periodStart: z.iso.datetime().optional(),
  periodEnd: z.iso.datetime().optional(),
  commentCount: z.number().int().nonnegative().optional(),
})

/** Recover a bounded legacy failure chain without exposing its errors or nesting it again. */
export const readCommunityInsight = (value: unknown): z.infer<typeof storedInsightSchema> | null => {
  let candidate = value
  for (let depth = 0; depth < 8; depth++) {
    if (typeof candidate === 'string') {
      try {
        candidate = JSON.parse(candidate) as unknown
      } catch {
        return null
      }
    }
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null
    const record = candidate as Record<string, unknown>
    if (record.error === true) {
      candidate = record.previous
      continue
    }
    const parsed = storedInsightSchema.safeParse({
      ...record,
      summary: typeof record.summary === 'string' ? record.summary.slice(0, 250) : record.summary,
    })
    return parsed.success ? parsed.data : null
  }
  return null
}

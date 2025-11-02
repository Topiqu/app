import type { ClientPlan } from '@zenstackhq/runtime/models'

import { generateObject } from 'ai'

const basicSchema = z.object({
  label: z.enum(['negative', 'neutral', 'positive']),
  score: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
})

const premiumSchema = z.object({
  label: z.enum(['very_negative', 'negative', 'neutral', 'positive', 'very_positive']),
  score: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
  emotions: z.object({
    joy: z.number(),
    anger: z.number(),
    sadness: z.number(),
    fear: z.number(),
    surprise: z.number(),
  }),
  toxicity: z.number().min(0).max(1),
  helpfulness: z.number().min(0).max(1),
  sarcasm: z.number().min(0).max(1),
  point: z.string().max(75).trim(),
})
export const detectSentiment = async (text: string, plan: ClientPlan) => {
  const schema = plan === 'PREMIUM' ? premiumSchema : basicSchema

  const { object, usage } = await generateObject({
    model: xai('grok-4-fast-reasoning'),
    system:
      plan === 'PREMIUM'
        ? `Analyze sentiment with 5-tier label, emotion breakdown, toxicity, helpfulness, sarcasm. Extract main point in ≤75 chars. Score -1 to 1. Return ONLY valid JSON.`
        : `Analyze sentiment with 3-tier label. Score -1 to 1. Return ONLY valid JSON.`,
    prompt: text.slice(0, 1000),
    schema,
    temperature: 0,
  })

  return { object, usage }
}

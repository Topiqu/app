import type { ClientPlan } from '~~/generated/zenstack/models'

import { z } from 'zod'
import { generateText, Output } from 'ai'

import { aiReasoning } from './reasoning'

const proportion = z.number().min(0).max(1)

const basicSchema = z.object({
  label: z.enum(['negative', 'neutral', 'positive']),
  score: z.number().min(-1).max(1),
  confidence: proportion,
})

const premiumSchema = z.object({
  label: z.enum(['very_negative', 'negative', 'neutral', 'positive', 'very_positive']),
  score: z.number().min(-1).max(1),
  confidence: proportion,
  emotions: z.object({
    joy: proportion,
    anger: proportion,
    sadness: proportion,
    fear: proportion,
    surprise: proportion,
  }),
  toxicity: proportion,
  helpfulness: proportion,
  sarcasm: proportion,
  point: z.string().max(75).trim(),
})
export const detectSentiment = async (text: string, plan: ClientPlan) => {
  const advanced = plan === 'PREMIUM' || plan === 'CUSTOM'
  const schema = advanced ? premiumSchema : basicSchema

  const { output: object, usage } = await generateText({
    model: aiModel('sentiment'),
    providerOptions: aiReasoning('medium'),
    instructions: advanced
      ? `Analyze sentiment with 5-tier label, emotion breakdown, toxicity, helpfulness, sarcasm. Extract main point in ≤75 chars. Score -1 to 1. Return ONLY valid JSON.`
      : `Analyze sentiment with 3-tier label. Score -1 to 1. Return ONLY valid JSON.`,
    prompt: text.slice(0, 1000),
    output: Output.object({ schema }),
    abortSignal: AbortSignal.timeout(60_000),
    maxRetries: 1,
  })

  return { object, usage }
}

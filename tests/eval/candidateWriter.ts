// Writers tried in the prose eval before they earn a place in `ARTICLE_WRITERS`.
import { createGoogleGenerativeAI } from '@ai-sdk/google'

import { aiTextPrice } from '../../server/utils/ai/spend'

// USD per million tokens, thinking billed as output. Source: aistudio.google.com/docs/pricing (2026-11-16).
const CANDIDATE_PRICES: Record<string, { input: number; output: number }> = {
  'gemini-4-hydrogen': { input: 1.5, output: 7.5 },
}

export const isCandidateWriter = (model: string) => Object.hasOwn(CANDIDATE_PRICES, model)

export const evalTextPrice = (model: string, input: number) => CANDIDATE_PRICES[model] ?? aiTextPrice(model, input)

/** Reads `GOOGLE_GENERATIVE_AI_API_KEY`, the same variable as `nuxt.config.ts`. */
export const candidateWriter = (model: string) => createGoogleGenerativeAI()(model)

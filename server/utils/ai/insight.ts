import { z } from 'zod'
import { COMMUNITY_EMOTIONS } from '~~/shared/utils/communityInsight'

export const insightSchema = z.object({
  summary: z.string().min(20).max(400),
  avgScore: z.number().min(-1).max(1),
  topEmotion: z
    .enum(COMMUNITY_EMOTIONS)
    .nullable()
    .describe('Canonical emotion identifier; the interface translates the label.'),
  toxicity: z.number().min(0).max(1),
  helpfulness: z.number().min(0).max(1),
  sarcasm: z.number().min(0).max(1),
  suggestion: z.string().max(250).nullable(),
})

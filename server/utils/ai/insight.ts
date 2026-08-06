export const insightSchema = z.object({
  summary: z.string().min(20).max(400),
  avgScore: z.number().min(-1).max(1),
  topEmotion: z.string().nullable(),
  toxicity: z.number().min(0).max(1),
  helpfulness: z.number().min(0).max(1),
  sarcasm: z.number().min(0).max(1),
  suggestion: z.string().max(250).nullable(),
})

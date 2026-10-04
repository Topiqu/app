import { z } from 'zod'

export const searchResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  domain: z.string(),
  description: z.string(),
})

export const keywordOpportunitySchema = z.object({
  reason: z.string().min(1).max(300),
  angle: z.string().min(1).max(300),
  articleFit: z.enum(['strong', 'possible']),
  specificity: z.enum(['focused', 'broad']).default('broad'),
  evidence: z.enum(['serp', 'metrics']),
  organic: z.array(searchResultSchema).max(5),
  profile: z.string(),
  checkedAt: z.string(),
})

export type SearchResult = z.infer<typeof searchResultSchema>
export type KeywordOpportunity = z.infer<typeof keywordOpportunitySchema>

export const keywordOpportunity = (value: unknown): KeywordOpportunity | null => {
  const parsed = keywordOpportunitySchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

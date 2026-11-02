import { z } from 'zod'

export const SERIES_ARTICLE_LIMIT = 100

export const createSeriesSchema = z.object({
  name: z.string().trim().min(1).max(255),
  slug: z.string().trim().max(100).optional(),
  description: z.string().trim().max(500).optional(),
  articleIds: z.array(z.string().min(1).max(128)).max(SERIES_ARTICLE_LIMIT).default([]),
})

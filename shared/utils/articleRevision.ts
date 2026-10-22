import { z } from 'zod'

// Publication state, URLs and ownership are deliberately not restored from history.
export const articleRevisionSnapshot = z.object({
  title: z.string().min(1).max(255),
  excerpt: z.string().nullable(),
  content: z
    .string()
    .max(50_000)
    .nullable()
    .transform((value) => value ?? ''),
  imageUrl: z.string().nullable(),
  imageCredit: z.json().nullable(),
  coverMediaId: z.string().nullable(),
  answer: z.string().max(600).nullable(),
  keyTakeaways: z
    .array(z.string())
    .nullish()
    .transform((value) => value ?? []),
  faq: z.json().nullable(),
  sources: z
    .array(z.string())
    .nullish()
    .transform((value) => value ?? []),
  format: z.string().nullable(),
  structureVariant: z.string().nullable(),
  prompt: z.string().max(5000).nullable(),
  tagIds: z.array(z.string().uuid()).max(100).default([]),
})
export interface ArticleRevisionSnapshot {
  title: string
  excerpt: string | null
  content: string
  imageUrl: string | null
  imageCredit: unknown
  coverMediaId: string | null
  answer: string | null
  keyTakeaways: string[]
  faq: unknown
  sources: string[]
  format: string | null
  structureVariant: string | null
  prompt: string | null
  tagIds: string[]
}

export interface ArticleRevisionSummary {
  id: string
  version: number
  title: string
  actorName: string | null
  createdAt: Date
}

export const requiresArticleVersion = (body: Record<string, unknown>) =>
  Object.keys(articleRevisionSnapshot.shape).some((key) => key in body)

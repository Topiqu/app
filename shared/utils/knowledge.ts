export const KNOWLEDGE_LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxSourceCharacters: 400_000,
  maxNoteCharacters: 50_000,
  // Each page is one `POST /api/knowledge`, which is rate limited at 60 an hour per tenant.
  maxSitemapPages: 50,
} as const

type KnowledgeQuota = { maxSources: number; maxCharacters: number }

/** BASIC has no AI, so no knowledge to feed it. Plan names are the `ClientPlan` enum. */
export const KNOWLEDGE_PLAN_QUOTAS: Record<string, KnowledgeQuota> = {
  BASIC: { maxSources: 0, maxCharacters: 0 },
  PRO: { maxSources: 50, maxCharacters: 1_000_000 },
  PREMIUM: { maxSources: 200, maxCharacters: 5_000_000 },
  CUSTOM: { maxSources: 500, maxCharacters: 15_000_000 },
}

export const knowledgeQuota = (plan?: string | null): KnowledgeQuota =>
  KNOWLEDGE_PLAN_QUOTAS[plan ?? ''] ?? KNOWLEDGE_PLAN_QUOTAS.BASIC!

/**
 * Bump when the wording of the "may be published" confirmation changes, so the audit log shows
 * which text each source was added under.
 */
export const KNOWLEDGE_CONSENT_VERSION = 1

/** How long a URL source may go without being fetched again. */
export const KNOWLEDGE_REFRESH_DAYS = 7

/** Beyond this, a time-sensitive claim resting only on the source needs fresher evidence. */
export const KNOWLEDGE_STALE_MONTHS = 12

export const KNOWLEDGE_FILE_EXTENSIONS = ['pdf', 'docx', 'txt', 'md'] as const

export type KnowledgeFileExtension = (typeof KNOWLEDGE_FILE_EXTENSIONS)[number]

/** The date the reviewer judges staleness by: an explicit validity date, else the last fetch, else indexing. */
export const knowledgeAsOf = (source: {
  validAsOf?: Date | string | null
  fetchedAt?: Date | string | null
  indexedAt?: Date | string | null
}) => source.validAsOf ?? source.fetchedAt ?? source.indexedAt ?? null

export const isKnowledgeStale = (asOf: Date | string | null, now = new Date()) => {
  if (!asOf) return false
  const threshold = new Date(now)
  threshold.setMonth(threshold.getMonth() - KNOWLEDGE_STALE_MONTHS)
  return new Date(asOf) < threshold
}

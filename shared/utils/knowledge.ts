export const KNOWLEDGE_LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxSourceCharacters: 400_000,
  maxNoteCharacters: 50_000,
  // Each page is one `POST /api/knowledge`, which is rate limited at 60 an hour per tenant.
  maxSitemapPages: 50,
  maxFeedBytes: 50 * 1024 * 1024,
} as const

type KnowledgeQuota = { maxSources: number; maxCharacters: number; maxProducts: number }

/** BASIC has no AI, so no knowledge to feed it. Plan names are the `ClientPlan` enum. */
export const KNOWLEDGE_PLAN_QUOTAS: Record<string, KnowledgeQuota> = {
  BASIC: { maxSources: 0, maxCharacters: 0, maxProducts: 0 },
  PRO: { maxSources: 50, maxCharacters: 1_000_000, maxProducts: 500 },
  PREMIUM: { maxSources: 200, maxCharacters: 5_000_000, maxProducts: 3_000 },
  // Exact per-tenant vector scans stay cheap to ~50k chunks (MAP.md → Knowledge).
  CUSTOM: { maxSources: 500, maxCharacters: 15_000_000, maxProducts: 20_000 },
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

/** Shops regenerate feeds at least daily, and prices go stale faster than pages. */
export const KNOWLEDGE_FEED_REFRESH_HOURS = 24

/** ISO 4217 as the runtime knows it; the add form and the feed parser share this list. */
export const KNOWLEDGE_CURRENCIES: readonly string[] = Intl.supportedValuesOf('currency')

/** A failed feed sync stores one of these in `error`, so the list can say what is wrong. */
export const KNOWLEDGE_FEED_ERRORS = ['unreachable', 'tooLarge', 'notFeed', 'empty'] as const

export type KnowledgeFeedSkip = 'id' | 'name' | 'url'

export type KnowledgeFeedReport = {
  /** Feed entries read, before variants merge. */
  items: number
  products: number
  skipped: Partial<Record<KnowledgeFeedSkip, number>>
  /** Kept without a price: unparseable, or a currency that is not ISO 4217. */
  unpriced: number
  /** Dropped by the plan's product quota. */
  truncated: number
}

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

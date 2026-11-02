export const ARTICLE_QUALITY_LEVELS = ['STANDARD', 'HIGH', 'ULTRA'] as const

export type ArticleQuality = (typeof ARTICLE_QUALITY_LEVELS)[number]

/**
 * Tiers differ by writer model (`ARTICLE_WRITERS`: Luna, Terra, Sol), not effort: past `high` the larger
 * models spend far more tokens for little gain.
 */
export const ARTICLE_QUALITY_EFFORT = {
  STANDARD: 'high',
  HIGH: 'high',
  ULTRA: 'high',
} as const satisfies Record<ArticleQuality, string>

export const articleQualityOf = (value: unknown): ArticleQuality =>
  ARTICLE_QUALITY_LEVELS.includes(value as ArticleQuality) ? (value as ArticleQuality) : 'STANDARD'

export const ARTICLE_QUALITY_LEVELS = ['STANDARD', 'HIGH', 'ULTRA'] as const

export type ArticleQuality = (typeof ARTICLE_QUALITY_LEVELS)[number]

/** Every tier writes with GPT-6 Luna; tiers differ only in the writer's reasoning effort. */
export const ARTICLE_QUALITY_EFFORT = {
  STANDARD: 'high',
  HIGH: 'xhigh',
  ULTRA: 'max',
} as const satisfies Record<ArticleQuality, string>

export const articleQualityOf = (value: unknown): ArticleQuality =>
  ARTICLE_QUALITY_LEVELS.includes(value as ArticleQuality) ? (value as ArticleQuality) : 'STANDARD'

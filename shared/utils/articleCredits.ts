import { articleQualityOf, type ArticleQuality } from './articleQuality'

export const ARTICLE_CREDIT_POLICY_VERSION = '2026-10-quality-v3'
export const TRIAL_ARTICLE_CREDITS = 5

export const ARTICLE_QUALITY_CREDITS = { STANDARD: 1, HIGH: 2, ULTRA: 3 } as const satisfies Record<
  ArticleQuality,
  number
>

/** A fixed price for the complete article, including review and one automatic revision. */
export const articleCreditCost = (quality: unknown): number => ARTICLE_QUALITY_CREDITS[articleQualityOf(quality)]

export const affordableArticleCount = (credits: number, quality: unknown): number =>
  Number.isFinite(credits) ? Math.max(0, Math.floor(credits / articleCreditCost(quality))) : 0

export const PLAN_ARTICLE_CREDITS = {
  PRO: 50,
  PREMIUM: 100,
  CUSTOM: 100,
} as const

export type ArticleCreditPlan = keyof typeof PLAN_ARTICLE_CREDITS

export const articleCreditsForPlan = (plan: unknown): number =>
  typeof plan === 'string' && plan in PLAN_ARTICLE_CREDITS ? PLAN_ARTICLE_CREDITS[plan as ArticleCreditPlan] : 0

// Unused plan credits carry over while a paid AI plan is active, up to this many monthly allowances.
export const ARTICLE_ROLLOVER_MONTHS = 2

export const articleRolloverCap = (plan: unknown): number => ARTICLE_ROLLOVER_MONTHS * articleCreditsForPlan(plan)

export const nextArticleCreditMonth = (date: Date): Date => {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(date.getUTCDate(), lastDay),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  )
}

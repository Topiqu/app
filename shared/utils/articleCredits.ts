export const ARTICLE_CREDIT_POLICY_VERSION = '2026-09-articles-v1'
export const TRIAL_ARTICLE_CREDITS = 5

export const PLAN_ARTICLE_CREDITS = {
  PRO: 20,
  PREMIUM: 30,
} as const

export type ArticleCreditPlan = keyof typeof PLAN_ARTICLE_CREDITS

export const articleCreditsForPlan = (plan: unknown): number =>
  typeof plan === 'string' && plan in PLAN_ARTICLE_CREDITS ? PLAN_ARTICLE_CREDITS[plan as ArticleCreditPlan] : 0

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

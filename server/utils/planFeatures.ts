import type { ClientPlan } from '@prisma/client'

export type FeatureCode = 'AI' | 'SENTIMENT' | 'ARTICLE_CRONS'

export const FEATURE_CODES: FeatureCode[] = ['AI', 'SENTIMENT', 'ARTICLE_CRONS']

export const FEATURE_DEPENDENCIES: Record<FeatureCode, FeatureCode[]> = {
  AI: [],
  SENTIMENT: ['AI'],
  ARTICLE_CRONS: ['AI'],
}

export const getAllowedFeatures = (plan: ClientPlan): Record<FeatureCode, boolean> => ({
  AI: ['PRO', 'PREMIUM', 'CUSTOM'].includes(plan),
  SENTIMENT: ['PREMIUM', 'CUSTOM'].includes(plan),
  ARTICLE_CRONS: ['PRO', 'PREMIUM', 'CUSTOM'].includes(plan),
})

export const isAlaCartePlan = (plan: ClientPlan): boolean => plan === 'CUSTOM'

export const getMissingDependencies = (code: FeatureCode, active: FeatureCode[]): FeatureCode[] =>
  FEATURE_DEPENDENCIES[code].filter((dep) => !active.includes(dep))

export const getDependents = (code: FeatureCode): FeatureCode[] =>
  FEATURE_CODES.filter((c) => FEATURE_DEPENDENCIES[c].includes(code))

export const billableMonthlyTotal = (plan: ClientPlan, billingPlan: string, billedPrices: number[]): number =>
  isAlaCartePlan(plan) && billingPlan !== 'PERMANENT' ? billedPrices.reduce((sum, price) => sum + price, 0) : 0

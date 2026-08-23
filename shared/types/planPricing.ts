export type SubscribablePlan = 'PRO' | 'PREMIUM'
export type BillingInterval = 'month' | 'year'

export interface PlanPrice {
  amount: number
  currency: string
  interval: BillingInterval
}

export type PlanPricing = Record<SubscribablePlan, Record<BillingInterval, PlanPrice | null>>

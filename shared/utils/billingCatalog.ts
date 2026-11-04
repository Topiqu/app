export const BILLING_POLICY_VERSION = '2026-11-04'

export const PLAN_PRICE_CENTS = {
  PRO: { month: 4900, year: 47040 },
  PREMIUM: { month: 9900, year: 95040 },
} as const

export const CUSTOM_MIN_SEATS = 3
export const CUSTOM_MAX_SEATS = 1000
export const CUSTOM_BASE_CENTS = { month: 15900, year: 152640 } as const
export const CUSTOM_MEMBER_CENTS = { month: 2000, year: 19200 } as const

export const customPriceCents = (seats: number, interval: 'month' | 'year') => {
  if (!Number.isSafeInteger(seats) || seats < CUSTOM_MIN_SEATS || seats > CUSTOM_MAX_SEATS)
    throw new RangeError('Invalid CUSTOM seat count')
  return CUSTOM_BASE_CENTS[interval] + (seats - 1) * CUSTOM_MEMBER_CENTS[interval]
}

export const AI_ALLOWANCE_KINDS = ['BUDGET', 'TRANSLATION', 'EDIT', 'VISIBILITY'] as const
export type AiAllowanceKind = (typeof AI_ALLOWANCE_KINDS)[number]

export const AI_ALLOWANCES = {
  TRIAL: { BUDGET: 1_000_000, TRANSLATION: 10, EDIT: 50, VISIBILITY: 10 },
  PRO: { BUDGET: 7_350_000, TRANSLATION: 60, EDIT: 200, VISIBILITY: 0 },
  PREMIUM: { BUDGET: 14_850_000, TRANSLATION: 250, EDIT: 500, VISIBILITY: 300 },
  CUSTOM: { BUDGET: 23_850_000, TRANSLATION: 250, EDIT: 500, VISIBILITY: 300 },
} as const

// These are separate purchases; existing article balances never pay for auxiliary operations.
export const AI_USAGE_PACKS = {
  small: { priceCents: 899, BUDGET: 1_000_000, TRANSLATION: 10, EDIT: 50, VISIBILITY: 10 },
  medium: { priceCents: 1499, BUDGET: 2_000_000, TRANSLATION: 25, EDIT: 125, VISIBILITY: 25 },
  large: { priceCents: 2249, BUDGET: 3_000_000, TRANSLATION: 50, EDIT: 250, VISIBILITY: 50 },
} as const

export type AiUsagePackId = keyof typeof AI_USAGE_PACKS
export const aiUsagePack = (id: unknown) =>
  typeof id === 'string' && Object.hasOwn(AI_USAGE_PACKS, id) ? AI_USAGE_PACKS[id as AiUsagePackId] : null

export const BILLING_POLICY_VERSION = '2026-11-06'

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

export const AI_ALLOWANCE_KINDS = ['BUDGET', 'SEO', 'TRANSLATION', 'EDIT', 'VISIBILITY'] as const
export type AiAllowanceKind = (typeof AI_ALLOWANCE_KINDS)[number]

/** Circuit breakers in micro-USD (AI providers, DataForSEO). Customers see article units and counts only. */
export const INTERNAL_AI_ALLOWANCE_KINDS = ['BUDGET', 'SEO'] as const satisfies readonly AiAllowanceKind[]
export const isInternalAiAllowance = (kind: string) => (INTERNAL_AI_ALLOWANCE_KINDS as readonly string[]).includes(kind)

// AI provider cost may reach half of the net plan price (micro-USD per cent of invoice).
export const AI_BUDGET_MICROS_PER_CENT = 5000
// AI funding minted per carried article unit, above the $0.194 STANDARD worst case.
export const ARTICLE_UNIT_FUNDING_MICROS = 250_000

export const AI_ALLOWANCES = {
  TRIAL: { BUDGET: 2_000_000, SEO: 1_000_000, TRANSLATION: 10, EDIT: 50, VISIBILITY: 10 },
  PRO: { BUDGET: 24_500_000, SEO: 10_000_000, TRANSLATION: 60, EDIT: 200, VISIBILITY: 0 },
  PREMIUM: { BUDGET: 49_500_000, SEO: 20_000_000, TRANSLATION: 250, EDIT: 500, VISIBILITY: 300 },
  CUSTOM: { BUDGET: 79_500_000, SEO: 20_000_000, TRANSLATION: 250, EDIT: 500, VISIBILITY: 300 },
} as const

// These are separate purchases; existing article balances never pay for auxiliary operations.
export const AI_USAGE_PACKS = {
  small: { priceCents: 899, BUDGET: 1_000_000, SEO: 0, TRANSLATION: 10, EDIT: 50, VISIBILITY: 10 },
  medium: { priceCents: 1499, BUDGET: 2_000_000, SEO: 0, TRANSLATION: 25, EDIT: 125, VISIBILITY: 25 },
  large: { priceCents: 2249, BUDGET: 3_000_000, SEO: 0, TRANSLATION: 50, EDIT: 250, VISIBILITY: 50 },
} as const

export type AiUsagePackId = keyof typeof AI_USAGE_PACKS
export const aiUsagePack = (id: unknown) =>
  typeof id === 'string' && Object.hasOwn(AI_USAGE_PACKS, id) ? AI_USAGE_PACKS[id as AiUsagePackId] : null

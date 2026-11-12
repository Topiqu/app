import { ARTICLE_ROLLOVER_MONTHS } from './articleCredits'
import { AI_ALLOWANCES, AI_BUDGET_MICROS_PER_CENT } from './billingCatalog'

/** Monthly agency subscription: a fee per client blog plus article units shared by all of them. */
export const AGENCY_BLOG_CENTS = 1000
/** Added to a blog's fee for the PREMIUM feature set. */
export const AGENCY_PREMIUM_CENTS = 2000
export const AGENCY_BLOCK_UNITS = 50
export const AGENCY_BLOCK_CENTS = 3000
export const AGENCY_MIN_BLOGS = 3
export const AGENCY_MIN_BLOCKS = 4
export const AGENCY_MAX_BLOGS = 500
export const AGENCY_MAX_BLOCKS = 400
/** DataForSEO breaker per blog: keyword-plan rebuilds and news run per blog, not per unit. */
export const AGENCY_SEO_MICROS_PER_BLOG = 5_000_000
/** PREMIUM rebuilds the keyword plan daily instead of every second day. */
export const AGENCY_SEO_MICROS_PER_PREMIUM = 5_000_000
/** PREMIUM includes three more translation languages, for about 30 articles. */
export const AGENCY_TRANSLATIONS_PER_PREMIUM = 90

/** BASIC is a paused blog: free, no slot, no AI. PRO takes a blog slot; PREMIUM also its add-on. */
export const AGENCY_BLOG_PLANS = ['BASIC', 'PRO', 'PREMIUM'] as const
export type AgencyBlogPlan = (typeof AGENCY_BLOG_PLANS)[number]

export type AgencyQuantities = { blogs: number; premium: number; blocks: number }
export type AgencySlots = { blogSlots: number; premiumSlots: number }

export const isAgencyQuantities = ({ blogs, premium, blocks }: AgencyQuantities) =>
  Number.isSafeInteger(blogs) &&
  Number.isSafeInteger(premium) &&
  Number.isSafeInteger(blocks) &&
  blogs >= AGENCY_MIN_BLOGS &&
  blogs <= AGENCY_MAX_BLOGS &&
  premium >= 0 &&
  premium <= blogs &&
  blocks >= AGENCY_MIN_BLOCKS &&
  blocks <= AGENCY_MAX_BLOCKS

export const agencyPriceCents = ({ blogs, premium, blocks }: AgencyQuantities) =>
  blogs * AGENCY_BLOG_CENTS + premium * AGENCY_PREMIUM_CENTS + blocks * AGENCY_BLOCK_CENTS

export const agencyUnits = (blocks: number) => blocks * AGENCY_BLOCK_UNITS

export const agencyRolloverCap = (blocks: number) => ARTICLE_ROLLOVER_MONTHS * agencyUnits(blocks)

/** The same circuit breakers as a direct plan: AI at half the list price, counts per 50 units as on PRO. */
export const agencyAllowances = ({ blogs, premium, blocks }: AgencyQuantities) => ({
  BUDGET: agencyPriceCents({ blogs, premium, blocks }) * AI_BUDGET_MICROS_PER_CENT,
  SEO: blogs * AGENCY_SEO_MICROS_PER_BLOG + premium * AGENCY_SEO_MICROS_PER_PREMIUM,
  TRANSLATION: blocks * 60 + premium * AGENCY_TRANSLATIONS_PER_PREMIUM,
  EDIT: blocks * 200,
  VISIBILITY: premium * AI_ALLOWANCES.PREMIUM.VISIBILITY,
})

/** Which slot the blogs' plans lack, if any. `plans` lists every blog billed by the agency. */
export const agencySlotShortfall = ({ blogSlots, premiumSlots }: AgencySlots, plans: readonly (string | null)[]) =>
  plans.filter((plan) => plan === 'PRO' || plan === 'PREMIUM').length > blogSlots
    ? ('NO_FREE_SLOT' as const)
    : plans.filter((plan) => plan === 'PREMIUM').length > premiumSlots
      ? ('NO_FREE_PREMIUM_SLOT' as const)
      : null

/** PAST_DUE is Stripe's dunning grace: blogs stay on, but no new period is funded until an invoice is paid. */
export const isAgencyLive = (status: string) => status === 'ACTIVE' || status === 'PAST_DUE'

import type Stripe from 'stripe'
import type { SubscribablePlan } from '~~/shared/types/planPricing'

import { CUSTOM_MIN_SEATS, CUSTOM_MAX_SEATS } from '~~/shared/utils/billingCatalog'

export const isSubscribablePlan = (value: unknown): value is SubscribablePlan =>
  value === 'PRO' || value === 'PREMIUM' || value === 'CUSTOM'

// The Customer Portal changes the subscription's price without touching `metadata.plan`,
// so the price ID is the only trustworthy source of the current plan.
export const planFromPriceId = (priceId: string | null | undefined): SubscribablePlan | null => {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_CUSTOM || priceId === process.env.STRIPE_PRICE_CUSTOM_ANNUAL) return 'CUSTOM'
  if (priceId === process.env.STRIPE_PRICE_PRO || priceId === process.env.STRIPE_PRICE_PRO_ANNUAL) return 'PRO'
  if (priceId === process.env.STRIPE_PRICE_PREMIUM || priceId === process.env.STRIPE_PRICE_PREMIUM_ANNUAL)
    return 'PREMIUM'
  // Retired offers stay recognizable for existing customers, but are never offered at checkout.
  if (process.env.STRIPE_LEGACY_PRICE_PRO_IDS?.split(',').some((id) => id.trim() === priceId)) return 'PRO'
  if (process.env.STRIPE_LEGACY_PRICE_PREMIUM_IDS?.split(',').some((id) => id.trim() === priceId)) return 'PREMIUM'
  return null
}

// A checkout that opens a trial still moves the plan — that is what the trial sells — but no money
// has changed hands, and `firstPaidAt` is the paid marker every trial predicate reads. Stamping it
// here would end the trial on the day it started.
export const marksFirstPayment = (
  status: Stripe.Subscription.Status | undefined,
  plan: SubscribablePlan | null,
): boolean => !!plan && status !== 'trialing'

// `past_due` is deliberately absent — that is the dunning grace period, expected to recover.
// `unpaid`/`incomplete_expired` are terminal but only ever arrive on `subscription.updated`,
// never as a `deleted`, so an account set to mark unpaid rather than cancel would otherwise
// leave the tenant on PREMIUM forever, generating articles against an unpaid invoice.
const REVOKING_STATUSES: Stripe.Subscription.Status[] = ['canceled', 'unpaid', 'incomplete_expired', 'paused']

export const revokesPlan = (status: Stripe.Subscription.Status): boolean => REVOKING_STATUSES.includes(status)

// Stripe API 2025-03-31.basil removed `invoice.subscription`.
// The subscription reference now lives on `invoice.parent.subscription_details.subscription`.
export const extractSubscriptionId = (invoice: Stripe.Invoice): string | null => {
  const ref = invoice.parent?.subscription_details?.subscription
  if (!ref) return null
  return typeof ref === 'string' ? ref : ref.id
}

/** Multi-item subscriptions are ordered by Stripe, never by our plan hierarchy. */
export const primaryPlanItem = (subscription: Stripe.Subscription) =>
  subscription.items.data.find((item) => planFromPriceId(item.price.id)) ?? subscription.items.data[0]

export const managedCustomSeats = (subscription: Stripe.Subscription): number | null => {
  const base = primaryPlanItem(subscription)
  if (!base || planFromPriceId(base.price.id) !== 'CUSTOM' || base.quantity !== 1) return null
  const interval = base.price.recurring?.interval
  const memberId =
    interval === 'year' ? process.env.STRIPE_PRICE_CUSTOM_MEMBER_ANNUAL : process.env.STRIPE_PRICE_CUSTOM_MEMBER
  const members = subscription.items.data.find((item) => item.price.id === memberId)
  const seats = 1 + (members?.quantity ?? 0)
  return members &&
    subscription.items.data.length === 2 &&
    Number.isSafeInteger(seats) &&
    seats >= CUSTOM_MIN_SEATS &&
    seats <= CUSTOM_MAX_SEATS
    ? seats
    : null
}

export const subscriptionPlan = (
  subscription: Stripe.Subscription,
  metadataPlan: unknown = subscription.metadata?.plan,
): SubscribablePlan | null => {
  const plan =
    planFromPriceId(primaryPlanItem(subscription)?.price.id) ??
    (isSubscribablePlan(metadataPlan) && metadataPlan !== 'CUSTOM' ? metadataPlan : null)
  return plan === 'CUSTOM' && managedCustomSeats(subscription) === null ? null : plan
}

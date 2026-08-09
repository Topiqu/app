import type Stripe from 'stripe'

export const isSubscribablePlan = (value: unknown): value is 'PRO' | 'PREMIUM' =>
  value === 'PRO' || value === 'PREMIUM'

// The Customer Portal changes the subscription's price without touching `metadata.plan`,
// so the price ID is the only trustworthy source of the current plan.
export const planFromPriceId = (priceId: string | null | undefined): 'PRO' | 'PREMIUM' | null => {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_PRO || priceId === process.env.STRIPE_PRICE_PRO_ANNUAL) return 'PRO'
  if (priceId === process.env.STRIPE_PRICE_PREMIUM || priceId === process.env.STRIPE_PRICE_PREMIUM_ANNUAL)
    return 'PREMIUM'
  return null
}

// A checkout that opens a trial still moves the plan — that is what the trial sells — but no money
// has changed hands, and `firstPaidAt` is the paid marker every trial predicate reads. Stamping it
// here would end the trial on the day it started.
export const marksFirstPayment = (
  status: Stripe.Subscription.Status | undefined,
  plan: 'PRO' | 'PREMIUM' | null,
): boolean => !!plan && status !== 'trialing'

// `past_due` is deliberately absent — that is the dunning grace period, expected to recover.
// `unpaid`/`incomplete_expired` are terminal but only ever arrive on `subscription.updated`,
// never as a `deleted`, so an account set to mark unpaid rather than cancel would otherwise
// leave the tenant on PREMIUM forever, generating articles against an unpaid invoice.
const REVOKING_STATUSES: Stripe.Subscription.Status[] = ['canceled', 'unpaid', 'incomplete_expired']

export const revokesPlan = (status: Stripe.Subscription.Status): boolean => REVOKING_STATUSES.includes(status)

// Stripe API 2025-03-31.basil removed `invoice.subscription`.
// The subscription reference now lives on `invoice.parent.subscription_details.subscription`.
export const extractSubscriptionId = (invoice: Stripe.Invoice): string | null => {
  const ref = invoice.parent?.subscription_details?.subscription
  if (!ref) return null
  return typeof ref === 'string' ? ref : ref.id
}

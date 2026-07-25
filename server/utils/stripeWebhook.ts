import type Stripe from 'stripe'

export const isSubscribablePlan = (value: unknown): value is 'PRO' | 'PREMIUM' =>
  value === 'PRO' || value === 'PREMIUM'

// Reverse-maps a Stripe price ID back to a plan. Needed because the Customer
// Portal changes the subscription's price without touching our metadata.plan,
// so the price ID is the only trustworthy source of the current plan.
export const planFromPriceId = (priceId: string | null | undefined): 'PRO' | 'PREMIUM' | null => {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_PRO || priceId === process.env.STRIPE_PRICE_PRO_ANNUAL) return 'PRO'
  if (priceId === process.env.STRIPE_PRICE_PREMIUM || priceId === process.env.STRIPE_PRICE_PREMIUM_ANNUAL)
    return 'PREMIUM'
  return null
}

// Stripe API 2025-03-31.basil removed `invoice.subscription`.
// The subscription reference now lives on `invoice.parent.subscription_details.subscription`.
export const extractSubscriptionId = (invoice: Stripe.Invoice): string | null => {
  const ref = invoice.parent?.subscription_details?.subscription
  if (!ref) return null
  return typeof ref === 'string' ? ref : ref.id
}

import type Stripe from 'stripe'

export const isSubscribablePlan = (value: unknown): value is 'PRO' | 'PREMIUM' =>
  value === 'PRO' || value === 'PREMIUM'

// Stripe API 2025-03-31.basil removed `invoice.subscription`.
// The subscription reference now lives on `invoice.parent.subscription_details.subscription`.
export const extractSubscriptionId = (invoice: Stripe.Invoice): string | null => {
  const ref = invoice.parent?.subscription_details?.subscription
  if (!ref) return null
  return typeof ref === 'string' ? ref : ref.id
}

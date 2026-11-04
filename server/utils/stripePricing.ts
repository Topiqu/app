import type Stripe from 'stripe'

import type { BillingInterval, SubscribablePlan } from '../../shared/types/planPricing'

import { PLAN_PRICE_CENTS, CUSTOM_BASE_CENTS, CUSTOM_MEMBER_CENTS } from '../../shared/utils/billingCatalog'

export const configuredPlanPriceId = (plan: SubscribablePlan, interval: BillingInterval): string | undefined =>
  plan === 'CUSTOM'
    ? interval === 'year'
      ? process.env.STRIPE_PRICE_CUSTOM_ANNUAL
      : process.env.STRIPE_PRICE_CUSTOM
    : plan === 'PRO'
      ? interval === 'year'
        ? process.env.STRIPE_PRICE_PRO_ANNUAL
        : process.env.STRIPE_PRICE_PRO
      : interval === 'year'
        ? process.env.STRIPE_PRICE_PREMIUM_ANNUAL
        : process.env.STRIPE_PRICE_PREMIUM

export const isExpectedPlanPrice = (
  price: Stripe.Price,
  plan: SubscribablePlan,
  interval: BillingInterval,
  liveMode: boolean,
): boolean =>
  price.active &&
  price.livemode === liveMode &&
  price.currency === 'usd' &&
  price.unit_amount === (plan === 'CUSTOM' ? CUSTOM_BASE_CENTS[interval] : PLAN_PRICE_CENTS[plan][interval]) &&
  price.recurring?.interval === interval &&
  price.recurring.interval_count === 1 &&
  price.recurring.usage_type === 'licensed' &&
  price.billing_scheme === 'per_unit' &&
  price.transform_quantity === null &&
  typeof price.product !== 'string' &&
  !price.product.deleted &&
  price.product.active &&
  price.product.id ===
    (plan === 'CUSTOM'
      ? process.env.STRIPE_PRODUCT_CUSTOM
      : plan === 'PRO'
        ? process.env.STRIPE_PRODUCT_PRO
        : process.env.STRIPE_PRODUCT_PREMIUM)

export const getConfiguredMemberPrice = async (interval: BillingInterval) => {
  const id =
    interval === 'year' ? process.env.STRIPE_PRICE_CUSTOM_MEMBER_ANNUAL : process.env.STRIPE_PRICE_CUSTOM_MEMBER
  if (!id || !process.env.STRIPE_SK) return null
  const price = await useStripe().prices.retrieve(id, { expand: ['product'] })
  const liveMode = /^(sk|rk)_live_/.test(process.env.STRIPE_SK)
  if (
    price.active &&
    price.livemode === liveMode &&
    price.currency === 'usd' &&
    price.unit_amount === CUSTOM_MEMBER_CENTS[interval] &&
    price.recurring?.interval === interval &&
    price.recurring.interval_count === 1 &&
    price.recurring.usage_type === 'licensed' &&
    price.billing_scheme === 'per_unit' &&
    price.transform_quantity === null &&
    typeof price.product !== 'string' &&
    !price.product.deleted &&
    price.product.active &&
    price.product.id === process.env.STRIPE_PRODUCT_CUSTOM_MEMBER
  )
    return price
  await reportCaughtError('Stripe member price mismatch', new Error('CUSTOM_MEMBER_PRICE_MISMATCH'), { interval })
  return null
}

/** Validate the actual catalog before checkout or presenting an actionable offer. */
export const getConfiguredPlanPrice = async (plan: SubscribablePlan, interval: BillingInterval) => {
  const id = configuredPlanPriceId(plan, interval)
  const key = process.env.STRIPE_SK
  if (!id || !key) return null
  try {
    const price = await useStripe().prices.retrieve(id, { expand: ['product'] })
    const liveMode = key.startsWith('sk_live_') || key.startsWith('rk_live_')
    if (isExpectedPlanPrice(price, plan, interval, liveMode)) return price
    await reportCaughtError('Stripe plan price mismatch', new Error('Configured price does not match the offer'), {
      plan,
      interval,
    })
  } catch (error) {
    await reportCaughtError('Stripe plan price lookup failed', error, { plan, interval })
  }
  return null
}

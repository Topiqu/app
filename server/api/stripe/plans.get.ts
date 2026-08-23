import type { BillingInterval, PlanPrice, PlanPricing, SubscribablePlan } from '~~/shared/types/planPricing'

const PRICE_IDS: Record<SubscribablePlan, Record<BillingInterval, string | undefined>> = {
  PRO: { month: process.env.STRIPE_PRICE_PRO, year: process.env.STRIPE_PRICE_PRO_ANNUAL },
  PREMIUM: { month: process.env.STRIPE_PRICE_PREMIUM, year: process.env.STRIPE_PRICE_PREMIUM_ANNUAL },
}

export default defineEventHandler(async (event): Promise<PlanPricing> => {
  await requireUser(event)
  const stripe = useStripe()

  const entries = await Promise.all(
    (Object.entries(PRICE_IDS) as [SubscribablePlan, Record<BillingInterval, string | undefined>][]).flatMap(
      ([plan, prices]) =>
        (Object.entries(prices) as [BillingInterval, string | undefined][]).map(async ([interval, id]) => {
          if (!id) return [plan, interval, null] as const
          const price = await stripe.prices.retrieve(id).catch(() => null)
          const value: PlanPrice | null =
            price?.unit_amount != null
              ? { amount: price.unit_amount, currency: price.currency.toUpperCase(), interval }
              : null
          return [plan, interval, value] as const
        }),
    ),
  )

  const result: PlanPricing = { PRO: { month: null, year: null }, PREMIUM: { month: null, year: null } }
  for (const [plan, interval, price] of entries) result[plan][interval] = price
  return result
})

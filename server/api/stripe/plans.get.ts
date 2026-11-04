import { CUSTOM_MIN_SEATS } from '~~/shared/utils/billingCatalog'

export default defineEventHandler(async (event): Promise<PlanPricing> => {
  await requireUser(event)
  const entries = await Promise.all(
    (['PRO', 'PREMIUM', 'CUSTOM'] as const).flatMap((plan) =>
      (['month', 'year'] as const).map(async (interval) => {
        const price = await getConfiguredPlanPrice(plan, interval)
        const member = plan === 'CUSTOM' ? await getConfiguredMemberPrice(interval) : null
        const value: PlanPrice | null =
          price?.unit_amount != null && (plan !== 'CUSTOM' || member)
            ? {
                amount: price.unit_amount + (member?.unit_amount ?? 0) * (CUSTOM_MIN_SEATS - 1),
                currency: price.currency.toUpperCase(),
                interval,
              }
            : null
        return [plan, interval, value] as const
      }),
    ),
  )

  const result: PlanPricing = {
    PRO: { month: null, year: null },
    PREMIUM: { month: null, year: null },
    CUSTOM: { month: null, year: null },
  }
  for (const [plan, interval, price] of entries) result[plan][interval] = price
  return result
})

import { annualFromMonthly, FEATURE_MIN_BILLING_DAYS } from '~~/server/utils/planFeatures'

export default defineEventHandler(async () => {
  const features = await prisma.feature.findMany({})
  return features.map((feature) => ({
    ...feature,
    annualBillingPrice: annualFromMonthly(feature.priceMonthly, 'ANNUAL'),
    minimumBillingDays: FEATURE_MIN_BILLING_DAYS,
  }))
})

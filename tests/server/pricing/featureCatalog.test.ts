// @vitest-environment node

import { afterEach, expect, it, vi } from 'vitest'

import { annualFromMonthly, FEATURE_MIN_BILLING_DAYS } from '../../../server/utils/planFeatures'

afterEach(() => vi.unstubAllGlobals())

it('quotes the billing policy instead of a legacy annual catalog value', async () => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('prisma', {
    feature: { findMany: vi.fn().mockResolvedValue([{ code: 'AI', priceMonthly: 7, priceAnnual: 999 }]) },
  })
  const handler = (await import('../../../server/api/features/index.get')).default
  const [feature] = await handler({} as never)
  expect(feature).toMatchObject({
    priceMonthly: 7,
    priceAnnual: 999,
    annualBillingPrice: annualFromMonthly(7, 'ANNUAL'),
    minimumBillingDays: FEATURE_MIN_BILLING_DAYS,
  })
  expect(feature?.annualBillingPrice).toBe(67)
})

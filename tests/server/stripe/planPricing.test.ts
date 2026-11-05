// @vitest-environment node
import type Stripe from 'stripe'

import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PLAN_PRICE_CENTS } from '../../../shared/utils/billingCatalog'
import { configuredPlanPriceId, getConfiguredPlanPrice, isExpectedPlanPrice } from '../../../server/utils/stripePricing'

const validPrice = (overrides: Partial<Stripe.Price> = {}): Stripe.Price =>
  ({
    id: 'price_pro',
    object: 'price',
    active: true,
    livemode: false,
    unit_amount: 4900,
    currency: 'usd',
    product: { id: 'prod_pro', active: true },
    recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
    billing_scheme: 'per_unit',
    transform_quantity: null,
    ...overrides,
  }) as Stripe.Price

const retrieve = vi.fn()
const checkout = vi.fn()
const portal = vi.fn()
const report = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('STRIPE_SK', 'sk_test_synthetic')
  vi.stubEnv('STRIPE_PRICE_PRO', 'price_pro')
  vi.stubEnv('STRIPE_PRICE_PRO_ANNUAL', 'price_pro_year')
  vi.stubEnv('STRIPE_PRODUCT_PRO', 'prod_pro')
  vi.stubEnv('STRIPE_PRODUCT_PREMIUM', 'prod_premium')
  vi.stubEnv('STRIPE_PORTAL_CONFIGURATION', '')
  retrieve.mockResolvedValue(validPrice())
  checkout.mockResolvedValue({ url: 'https://checkout.example.test/session' })
  portal.mockResolvedValue({ url: 'https://billing.example.test/session' })
  vi.stubGlobal('assertBlogNotClosing', vi.fn())
  vi.stubGlobal('useStripe', () => ({
    prices: { retrieve },
    checkout: { sessions: { create: checkout } },
    billingPortal: { sessions: { create: portal } },
    subscriptions: { retrieve: vi.fn().mockResolvedValue({ status: 'active' }) },
  }))
  vi.stubGlobal('reportCaughtError', report)
  vi.stubGlobal('getConfiguredPlanPrice', getConfiguredPlanPrice)
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('getSessionUser', async () => ({ id: 'owner', role: 'admin', clientSiteId: 'blog' }))
  vi.stubGlobal('requireTenantScope', vi.fn())
  vi.stubGlobal('withBillingLease', (_id: string, work: () => Promise<unknown>) => work())
  vi.stubGlobal('assertBillingLease', vi.fn().mockResolvedValue(undefined))
  vi.stubGlobal('renewBillingLease', vi.fn().mockResolvedValue(undefined))
  vi.stubGlobal('serializableTransaction', (work: (tx: unknown) => Promise<unknown>) => work(prisma))
  vi.stubGlobal('isSubscribablePlan', (plan: string) => ['PRO', 'PREMIUM', 'CUSTOM'].includes(plan))
  vi.stubGlobal('readBody', async () => ({ plan: 'PRO', origin: 'https://blog.example.test' }))
  vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (value: unknown) => unknown) =>
    parse({ plan: 'PRO', origin: 'https://blog.example.test' }),
  )
  vi.stubGlobal('rejectShopifyBilled', vi.fn())
  vi.stubGlobal('billingReturnUrl', async () => 'https://blog.example.test/en/settings?tab=billing')
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('prisma', {
    clientSite: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'blog',
        plan: 'BASIC',
        billingPlan: 'MONTHLY',
        billingProvider: 'STRIPE',
        stripeSubscriptionId: null,
        stripeCustomerId: 'cus_fixture',
      }),
      update: vi.fn(),
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('configured Stripe plan offers', () => {
  it('uses the monthly and discounted annual commercial amounts in cents', () => {
    expect(PLAN_PRICE_CENTS).toEqual({ PRO: { month: 4900, year: 47040 }, PREMIUM: { month: 9900, year: 95040 } })
    expect(configuredPlanPriceId('PRO', 'month')).toBe('price_pro')
    expect(configuredPlanPriceId('PRO', 'year')).toBe('price_pro_year')
  })

  it.each([
    ['retired amount', { unit_amount: 3900 }],
    ['wrong currency', { currency: 'eur' }],
    ['inactive price', { active: false }],
    ['wrong mode', { livemode: true }],
    ['inactive product', { product: { id: 'prod_pro', active: false } }],
    ['unrelated active product', { product: { id: 'prod_unrelated', active: true } }],
    ['unexpanded product', { product: 'prod_pro' }],
    ['annual interval', { recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' } }],
    ['multiple months', { recurring: { interval: 'month', interval_count: 2, usage_type: 'licensed' } }],
    ['metered usage', { recurring: { interval: 'month', interval_count: 1, usage_type: 'metered' } }],
  ])('rejects %s before creating a paid checkout', async (_label, override) => {
    retrieve.mockResolvedValue(validPrice(override as Partial<Stripe.Price>))
    const { default: route } = await import('../../../server/api/stripe/subscribe.post')
    await expect(route({} as never)).rejects.toMatchObject({ statusCode: 503 })
    expect(checkout).not.toHaveBeenCalled()
    expect(report).toHaveBeenCalled()
  })

  it('creates the selected offer only after authenticating, authorizing and validating its actual price', async () => {
    const { default: route } = await import('../../../server/api/stripe/subscribe.post')
    expect(await route({} as never)).toEqual({ url: 'https://checkout.example.test/session' })
    expect(requireTenantScope).toHaveBeenCalledWith(expect.anything(), 'BILLING_CHANGE', 'blog')
    expect(retrieve).toHaveBeenCalledWith('price_pro', { expand: ['product'] })
    expect(checkout).toHaveBeenCalledWith(
      expect.objectContaining({ line_items: [{ price: 'price_pro', quantity: 1 }], client_reference_id: 'blog' }),
      expect.anything(),
    )
  })

  it('reports a provider failure without creating a checkout', async () => {
    retrieve.mockRejectedValue(new Error('synthetic provider failure'))
    expect(await getConfiguredPlanPrice('PRO', 'month')).toBeNull()
    expect(report).toHaveBeenCalledWith('Stripe plan price lookup failed', expect.any(Error), {
      plan: 'PRO',
      interval: 'month',
    })
    expect(checkout).not.toHaveBeenCalled()
  })

  it('keeps existing subscribers out of a second subscription checkout', async () => {
    vi.stubGlobal('prisma', {
      clientSite: { findUnique: async () => ({ id: 'blog', stripeSubscriptionId: 'sub_existing' }) },
    })
    const { default: route } = await import('../../../server/api/stripe/subscribe.post')
    await expect(route({} as never)).rejects.toMatchObject({ statusCode: 409 })
    expect(retrieve).not.toHaveBeenCalled()
    expect(checkout).not.toHaveBeenCalled()
  })

  it('validates exact annual cents and the selected mode', () => {
    const annual = validPrice({
      unit_amount: 47040,
      recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' } as Stripe.Price.Recurring,
    })
    expect(isExpectedPlanPrice(annual, 'PRO', 'year', false)).toBe(true)
    expect(isExpectedPlanPrice(annual, 'PRO', 'month', false)).toBe(false)
    expect(isExpectedPlanPrice(annual, 'PRO', 'year', true)).toBe(false)
  })

  it('allows a new checkout after the previous completed subscription was canceled', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    vi.stubGlobal('syncPlanFeatures', vi.fn())
    vi.stubGlobal('cancelTranslationLanguageSubscription', vi.fn())
    vi.stubGlobal('prisma', {
      clientSite: {
        findUnique: async () => ({
          id: 'blog',
          stripeSubscriptionId: 'sub_canceled',
          billingCheckoutId: 'cs_completed',
        }),
        updateMany,
        update: vi.fn(),
      },
    })
    vi.stubGlobal('useStripe', () => ({
      prices: { retrieve },
      subscriptions: { retrieve: async () => ({ id: 'sub_canceled', status: 'canceled' }) },
      checkout: {
        sessions: {
          create: checkout,
          retrieve: async () => ({ id: 'cs_completed', status: 'complete', subscription: 'sub_canceled' }),
        },
      },
    }))
    const { default: route } = await import('../../../server/api/stripe/subscribe.post')
    await expect(route({} as never)).resolves.toHaveProperty('url')
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ plan: 'BASIC', stripeSubscriptionId: null }) }),
    )
    expect(checkout).toHaveBeenCalledOnce()
  })

  it('does not create another checkout while a completed payment is awaiting synchronization', async () => {
    vi.mocked(prisma.clientSite.findUnique).mockResolvedValue({
      id: 'blog',
      billingCheckoutId: 'cs_completed',
    } as never)
    vi.stubGlobal('useStripe', () => ({
      prices: { retrieve },
      subscriptions: { retrieve: async () => ({ id: 'sub_active', status: 'active' }) },
      checkout: {
        sessions: { create: checkout, retrieve: async () => ({ status: 'complete', subscription: 'sub_active' }) },
      },
    }))
    const { default: route } = await import('../../../server/api/stripe/subscribe.post')
    await expect(route({} as never)).rejects.toMatchObject({ statusCode: 409 })
    expect(checkout).not.toHaveBeenCalled()
  })

  it('uses the staged Customer Portal configuration only when the app environment selects it', async () => {
    vi.stubEnv('STRIPE_PORTAL_CONFIGURATION', 'bpc_staged')
    const { default: route } = await import('../../../server/api/stripe/portal.post')
    await route({} as never)
    expect(portal).toHaveBeenCalledWith({
      customer: 'cus_fixture',
      return_url: 'https://blog.example.test/en/settings?tab=billing',
      configuration: 'bpc_staged',
    })
  })
})

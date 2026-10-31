// @vitest-environment node
import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  fetchShopifySubscription,
  planFromShopifyHandle,
  rejectShopifyBilled,
  releaseShopifyBilling,
  syncShopifyPlan,
} from '../../../server/utils/shopify/billing'

describe('Shopify App Pricing sync', () => {
  let connection: Record<string, any> | null
  let site: { billingProvider: string; firstPaidAt: Date | null }
  let subscription: unknown
  let partnerOk: boolean
  const siteUpdate = vi.fn()
  const connectionUpdate = vi.fn()
  const syncPlanFeatures = vi.fn()
  const grantPlanArticleCredits = vi.fn()
  const fetchMock = vi.fn()
  const shopifyGraphql = vi.fn()
  const shopifyAccessToken = vi.fn(async () => 'admin-token')

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('SHOPIFY_PARTNER_ORG_ID', '123')
    vi.stubEnv('SHOPIFY_PARTNER_API_TOKEN', 'partner-token')
    vi.stubEnv('SHOPIFY_APP_ID', '456')
    connection = {
      shop: 'store.myshopify.com',
      shopGid: 'gid://shopify/Shop/1',
      planHandle: null,
      planCheckedAt: null,
      clientSiteId: 'site-1',
      clientSite: { billingProvider: 'SHOPIFY' },
    }
    site = { billingProvider: 'SHOPIFY', firstPaidAt: null }
    partnerOk = true
    subscription = {
      billingPeriod: 'EVERY_30_DAYS',
      trialEndsAt: null,
      currentBillingCycle: { startTime: '2026-10-01T00:00:00Z', endTime: '2026-10-31T00:00:00Z' },
      items: [{ handle: 'pro' }],
    }
    fetchMock.mockImplementation(async () =>
      partnerOk
        ? new Response(JSON.stringify({ data: { activeSubscription: subscription } }))
        : new Response(JSON.stringify({ errors: [{ message: 'Too many requests' }] }), { status: 429 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const tx = {
      clientSite: { findUnique: vi.fn(async () => site), update: siteUpdate },
      shopifyConnection: { update: connectionUpdate },
    }
    vi.stubGlobal('prisma', { shopifyConnection: { findUnique: vi.fn(async () => connection) } })
    vi.stubGlobal('serializableTransaction', async (run: (value: unknown) => Promise<unknown>) => run(tx))
    vi.stubGlobal('syncPlanFeatures', syncPlanFeatures)
    vi.stubGlobal('grantPlanArticleCredits', grantPlanArticleCredits)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('shopifyGraphql', shopifyGraphql)
    vi.stubGlobal('shopifyAccessToken', shopifyAccessToken)
    shopifyGraphql.mockRejectedValue(new Error('Admin API unavailable'))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('maps plan handles by prefix and ignores unknown plans', () => {
    expect(planFromShopifyHandle('pro')).toBe('PRO')
    expect(planFromShopifyHandle('Premium_annual')).toBe('PREMIUM')
    expect(planFromShopifyHandle('pro-monthly')).toBe('PRO')
    expect(planFromShopifyHandle('professional')).toBeNull()
    expect(planFromShopifyHandle('test-plan')).toBeNull()
    expect(planFromShopifyHandle('Pro annual')).toBe('PRO')
    expect(planFromShopifyHandle('Premium')).toBe('PREMIUM')
  })

  it('applies the active plan, its billing cycle and the cycle allowance', async () => {
    expect(await syncShopifyPlan('connection-1')).toMatchObject({ handles: ['pro'], annual: false })
    const [request] = fetchMock.mock.calls[0]!
    expect(request).toBe('https://partners.shopify.com/123/api/2026-07/graphql.json')
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).variables).toEqual({
      appId: 'gid://shopify/App/456',
      shopId: 'gid://shopify/Shop/1',
    })
    expect(siteUpdate).toHaveBeenCalledWith({
      where: { id: 'site-1' },
      data: expect.objectContaining({
        plan: 'PRO',
        billingPlan: 'MONTHLY',
        nextBillingAt: new Date('2026-10-31T00:00:00Z'),
        firstPaidAt: expect.any(Date),
      }),
    })
    expect(connectionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ planHandle: 'pro' }) }),
    )
    expect(syncPlanFeatures).toHaveBeenCalled()
    expect(grantPlanArticleCredits).toHaveBeenCalledWith(expect.anything(), {
      clientSiteId: 'site-1',
      plan: 'PRO',
      idempotencyKey: 'shopify:store.myshopify.com:2026-10-31T00:00:00.000Z:PRO',
      reason: 'PRO included articles',
      periodStart: new Date('2026-10-01T00:00:00Z'),
      periodEnd: new Date('2026-10-31T00:00:00Z'),
    })
  })

  it('drops to Basic after a cancellation only when Shopify had set the plan', async () => {
    subscription = null
    await syncShopifyPlan('connection-1')
    expect(siteUpdate).not.toHaveBeenCalled()

    connection!.planHandle = 'premium'
    await syncShopifyPlan('connection-1')
    expect(siteUpdate).toHaveBeenCalledWith({ where: { id: 'site-1' }, data: { plan: 'BASIC', nextBillingAt: null } })
    expect(grantPlanArticleCredits).not.toHaveBeenCalled()
  })

  it('never downgrades when neither the Partner nor the Admin API answers', async () => {
    connection!.planHandle = 'pro'
    partnerOk = false
    await expect(syncShopifyPlan('connection-1')).rejects.toThrow()
    expect(shopifyAccessToken).toHaveBeenCalledWith('connection-1')
    expect(siteUpdate).not.toHaveBeenCalled()
    expect(connectionUpdate).not.toHaveBeenCalled()
  })

  // The Partner API answers only for public apps, so an app under review reads the store's Admin API.
  it('falls back to the Admin API subscription when the Partner API fails', async () => {
    partnerOk = false
    shopifyGraphql.mockResolvedValue({
      currentAppInstallation: {
        activeSubscriptions: [
          {
            name: 'Premium',
            status: 'ACTIVE',
            createdAt: '2026-09-01T00:00:00Z',
            trialDays: 0,
            currentPeriodEnd: '2026-11-15T00:00:00Z',
            lineItems: [{ plan: { pricingDetails: { interval: 'EVERY_30_DAYS', planHandle: null } } }],
          },
        ],
      },
    })
    await syncShopifyPlan('connection-1')
    expect(shopifyGraphql).toHaveBeenCalledWith(
      'store.myshopify.com',
      'admin-token',
      expect.stringContaining('currentAppInstallation'),
    )
    expect(siteUpdate).toHaveBeenCalledWith({
      where: { id: 'site-1' },
      data: expect.objectContaining({
        plan: 'PREMIUM',
        billingPlan: 'MONTHLY',
        nextBillingAt: new Date('2026-11-15T00:00:00Z'),
      }),
    })
    expect(grantPlanArticleCredits).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idempotencyKey: 'shopify:store.myshopify.com:2026-11-15T00:00:00.000Z:PREMIUM',
        periodStart: new Date('2026-10-16T00:00:00Z'),
        periodEnd: new Date('2026-11-15T00:00:00Z'),
      }),
    )
  })

  it('reads an Admin API trial and an empty installation without the Partner API', async () => {
    vi.stubEnv('SHOPIFY_PARTNER_API_TOKEN', '')
    shopifyGraphql.mockResolvedValue({
      currentAppInstallation: {
        activeSubscriptions: [
          {
            name: 'Pro',
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            trialDays: 7,
            currentPeriodEnd: null,
            lineItems: [{ plan: { pricingDetails: { interval: 'ANNUAL', planHandle: 'pro-annual' } } }],
          },
        ],
      },
    })
    const subscription = await fetchShopifySubscription({
      shop: 'store.myshopify.com',
      shopGid: 'gid://shopify/Shop/1',
      accessToken: async () => 'installation-token',
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(subscription).toMatchObject({ handles: ['pro-annual', 'Pro'], annual: true, cycle: null })
    expect(subscription!.trialEndsAt!.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000)

    shopifyGraphql.mockResolvedValue({ currentAppInstallation: { activeSubscriptions: [] } })
    expect(
      await fetchShopifySubscription({ shop: 'store.myshopify.com', shopGid: 'gid', accessToken: async () => 'token' }),
    ).toBeNull()
  })

  it('skips Stripe-billed projects and recent checks unless forced', async () => {
    connection!.clientSite.billingProvider = 'STRIPE'
    await syncShopifyPlan('connection-1', { force: true })
    expect(fetchMock).not.toHaveBeenCalled()

    connection!.clientSite.billingProvider = 'SHOPIFY'
    connection!.planCheckedAt = new Date()
    await syncShopifyPlan('connection-1')
    expect(fetchMock).not.toHaveBeenCalled()
    await syncShopifyPlan('connection-1', { force: true })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('does not overwrite billing that was handed back to Stripe during the request', async () => {
    site.billingProvider = 'STRIPE'
    await syncShopifyPlan('connection-1')
    expect(siteUpdate).not.toHaveBeenCalled()
  })

  it('hands billing back to Stripe on uninstall and revokes only a Shopify-granted plan', async () => {
    const tx = {
      clientSite: { findUnique: vi.fn(async () => ({ billingProvider: 'SHOPIFY' })), update: siteUpdate },
      shopifyConnection: { update: connectionUpdate },
    }
    await releaseShopifyBilling(tx as never, { id: 'connection-1', clientSiteId: 'site-1', planHandle: 'pro' })
    expect(siteUpdate).toHaveBeenCalledWith({
      where: { id: 'site-1' },
      data: { billingProvider: 'STRIPE', plan: 'BASIC', nextBillingAt: null },
    })
    expect(syncPlanFeatures).toHaveBeenCalledWith(tx, 'site-1')
  })

  it('blocks Stripe charges for Shopify-billed projects and pending Shopify links', () => {
    vi.stubGlobal('getCookie', () => undefined)
    expect(() => rejectShopifyBilled({} as never, 'STRIPE')).not.toThrow()
    expect(() => rejectShopifyBilled({} as never, 'SHOPIFY')).toThrow(expect.objectContaining({ statusCode: 409 }))
    vi.stubGlobal('getCookie', () => 'store.myshopify.com')
    expect(() => rejectShopifyBilled({} as never, 'STRIPE')).toThrow(expect.objectContaining({ statusCode: 409 }))
  })
})

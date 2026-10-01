// @vitest-environment node
import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
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
  })

  it('applies the active plan, its billing cycle and the cycle allowance', async () => {
    await syncShopifyPlan('connection-1')
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
      idempotencyKey: 'shopify:store.myshopify.com:2026-10-01T00:00:00Z:PRO',
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

  it('never downgrades on a Partner API failure', async () => {
    connection!.planHandle = 'pro'
    partnerOk = false
    await expect(syncShopifyPlan('connection-1')).rejects.toThrow()
    expect(siteUpdate).not.toHaveBeenCalled()
    expect(connectionUpdate).not.toHaveBeenCalled()
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

import type { H3Event } from 'h3'

const PARTNER_API_VERSION = '2026-07'
const CHECK_INTERVAL_MS = 5 * 60_000
const DAY_MS = 86_400_000

const PARTNER_QUERY = `query TopiquSubscription($appId: ID!, $shopId: ID!) {
  activeSubscription(appId: $appId, shopId: $shopId) {
    billingPeriod
    trialEndsAt
    currentBillingCycle { startTime endTime }
    items { handle }
  }
}`

const ADMIN_QUERY = `query TopiquAppSubscriptions {
  currentAppInstallation {
    activeSubscriptions {
      name
      status
      createdAt
      trialDays
      currentPeriodEnd
      lineItems { plan { pricingDetails { ... on AppRecurringPricing { interval planHandle } } } }
    }
  }
}`

interface PartnerSubscription {
  billingPeriod: string
  trialEndsAt: string | null
  currentBillingCycle: { startTime: string; endTime: string } | null
  items: { handle: string }[]
}

interface AdminSubscription {
  name: string
  status: string
  createdAt: string
  trialDays: number
  currentPeriodEnd: string | null
  lineItems: { plan: { pricingDetails: { interval?: string; planHandle?: string | null } } }[]
}

export interface ShopifySubscription {
  handles: string[]
  annual: boolean
  cycle: { start: Date; end: Date } | null
  trialEndsAt: Date | null
}

const partnerConfigured = () =>
  Boolean(process.env.SHOPIFY_PARTNER_ORG_ID && process.env.SHOPIFY_PARTNER_API_TOKEN && process.env.SHOPIFY_APP_ID)

// Shopify App Pricing plans are matched by handle prefix: `pro…` and `premium…`. The Admin API may
// return no handle, so the plan name ("Pro", "Premium annual") is matched the same way.
export const planFromShopifyHandle = (handle: string): 'PRO' | 'PREMIUM' | null => {
  const value = handle.trim().toLowerCase()
  if (/^premium(?:[-_\s]|$)/.test(value)) return 'PREMIUM'
  if (/^pro(?:[-_\s]|$)/.test(value)) return 'PRO'
  return null
}

const fetchPartnerSubscription = async (shopGid: string): Promise<ShopifySubscription | null> => {
  const response = await fetch(
    `https://partners.shopify.com/${process.env.SHOPIFY_PARTNER_ORG_ID}/api/${PARTNER_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.SHOPIFY_PARTNER_API_TOKEN!,
      },
      body: JSON.stringify({
        query: PARTNER_QUERY,
        variables: { appId: `gid://shopify/App/${process.env.SHOPIFY_APP_ID}`, shopId: shopGid },
      }),
    },
  )
  const result = (await response.json().catch(() => null)) as {
    data?: { activeSubscription: PartnerSubscription | null }
    errors?: unknown[]
  } | null
  if (!response.ok || !result?.data || result.errors?.length) throw new Error('Shopify Partner API request failed')
  const subscription = result.data.activeSubscription
  if (!subscription) return null
  const cycle = subscription.currentBillingCycle
  return {
    handles: subscription.items.map((item) => item.handle),
    annual: subscription.billingPeriod === 'ANNUAL',
    cycle: cycle ? { start: new Date(cycle.startTime), end: new Date(cycle.endTime) } : null,
    trialEndsAt: subscription.trialEndsAt ? new Date(subscription.trialEndsAt) : null,
  }
}

const fromAdminSubscription = (subscription: AdminSubscription): ShopifySubscription => {
  const pricing = subscription.lineItems.map((item) => item.plan.pricingDetails).filter((details) => details.interval)
  const annual = pricing.some((details) => details.interval === 'ANNUAL')
  const trialEnd = new Date(new Date(subscription.createdAt).getTime() + subscription.trialDays * DAY_MS)
  const trialEndsAt = subscription.trialDays > 0 && trialEnd.getTime() > Date.now() ? trialEnd : null
  const end = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null
  // The Admin API reports no cycle start; Shopify cycles are exactly 30 days or one year.
  const start = end && new Date(end.getTime() - (annual ? 365 : 30) * DAY_MS)
  const handles = pricing.flatMap((details) => (details.planHandle ? [details.planHandle] : []))
  return {
    handles: [...handles, subscription.name],
    annual,
    cycle: start && end && !trialEndsAt ? { start, end } : null,
    trialEndsAt,
  }
}

/**
 * The store's active App Pricing subscription, or null when it has none. The Partner API answers only for
 * public apps, so an app under review (or a Partner outage) falls back to the store's Admin API.
 * Throws when neither answers: an outage must never read as "no subscription" and downgrade a store.
 */
export const fetchShopifySubscription = async (store: {
  shop: string
  shopGid: string
  accessToken: () => Promise<string>
}): Promise<ShopifySubscription | null> => {
  if (partnerConfigured()) {
    try {
      return await fetchPartnerSubscription(store.shopGid)
    } catch (error) {
      console.warn('SHOPIFY_PARTNER_SUBSCRIPTION_FAILED', store.shop, error)
    }
  }
  const data = await shopifyGraphql<{ currentAppInstallation: { activeSubscriptions: AdminSubscription[] } }>(
    store.shop,
    await store.accessToken(),
    ADMIN_QUERY,
  )
  const subscriptions = data.currentAppInstallation.activeSubscriptions
    .filter((subscription) => subscription.status === 'ACTIVE')
    .map(fromAdminSubscription)
  return (
    subscriptions.find((subscription) => subscription.handles.some(planFromShopifyHandle)) ?? subscriptions[0] ?? null
  )
}

/**
 * Mirrors the store's Shopify App Pricing subscription onto the project plan and article allowance.
 * Returns the subscription (null: none), or undefined when the project is not Shopify-billed or was just checked.
 */
export const syncShopifyPlan = async (
  connectionId: string,
  { force = false } = {},
): Promise<ShopifySubscription | null | undefined> => {
  const connection = await prisma.shopifyConnection.findUnique({
    where: { id: connectionId },
    select: {
      shop: true,
      shopGid: true,
      planHandle: true,
      planCheckedAt: true,
      clientSiteId: true,
      clientSite: { select: { billingProvider: true } },
    },
  })
  if (!connection?.shopGid || connection.clientSite.billingProvider !== 'SHOPIFY') return
  if (!force && connection.planCheckedAt && connection.planCheckedAt.getTime() > Date.now() - CHECK_INTERVAL_MS) return

  const subscription = await fetchShopifySubscription({
    shop: connection.shop,
    shopGid: connection.shopGid,
    accessToken: () => shopifyAccessToken(connectionId),
  })
  const handle = subscription?.handles.find((value) => planFromShopifyHandle(value)) ?? null
  const plan = handle ? planFromShopifyHandle(handle) : null
  const { clientSiteId } = connection
  const now = new Date()

  await serializableTransaction(async (tx) => {
    // The uninstall webhook may have handed billing back to Stripe while Shopify answered.
    const site = await tx.clientSite.findUnique({
      where: { id: clientSiteId },
      select: { billingProvider: true, firstPaidAt: true },
    })
    if (site?.billingProvider !== 'SHOPIFY') return
    await tx.shopifyConnection.update({ where: { id: connectionId }, data: { planHandle: handle, planCheckedAt: now } })

    if (!subscription || !plan) {
      // Never applied a Shopify plan: a running Topiqu trial stays with the trial expiry job.
      if (!connection.planHandle) return
      await tx.clientSite.update({ where: { id: clientSiteId }, data: { plan: 'BASIC', nextBillingAt: null } })
      await syncPlanFeatures(tx, clientSiteId)
      return
    }

    const { annual, cycle, trialEndsAt } = subscription
    await tx.clientSite.update({
      where: { id: clientSiteId },
      data: {
        plan,
        billingPlan: annual ? 'ANNUAL' : 'MONTHLY',
        nextBillingAt: cycle?.end ?? trialEndsAt,
        // Shopify owns the trial and renewal lifecycle, like a card-backed Stripe trial.
        firstPaidAt: site.firstPaidAt ?? now,
      },
    })
    await syncPlanFeatures(tx, clientSiteId)

    const periodStart = cycle?.start ?? now
    // Annual plans get monthly allowances; `grant-annual-article-credits` continues from this one.
    const periodEnd = annual
      ? nextArticleCreditMonth(periodStart)
      : (cycle?.end ?? trialEndsAt ?? nextArticleCreditMonth(periodStart))
    // Keyed by the cycle end: both APIs report it, while the Admin API only derives the start.
    const period = cycle ? cycle.end.toISOString() : `trial:${trialEndsAt?.toISOString() ?? null}`
    await grantPlanArticleCredits(tx, {
      clientSiteId,
      plan,
      idempotencyKey: `shopify:${connection.shop}:${period}:${plan}`,
      reason: `${plan} included articles`,
      periodStart,
      periodEnd,
    })
  })
  return subscription
}

/** Uninstalling cancels the Shopify subscription, so billing returns to Stripe. */
export const releaseShopifyBilling = async (
  tx: DatabaseTransaction,
  connection: { id: string; clientSiteId: string; planHandle: string | null },
) => {
  const site = await tx.clientSite.findUnique({
    where: { id: connection.clientSiteId },
    select: { billingProvider: true },
  })
  if (site?.billingProvider !== 'SHOPIFY') return
  await tx.shopifyConnection.update({ where: { id: connection.id }, data: { planHandle: null } })
  await tx.clientSite.update({
    where: { id: connection.clientSiteId },
    data: { billingProvider: 'STRIPE', ...(connection.planHandle ? { plan: 'BASIC', nextBillingAt: null } : {}) },
  })
  if (connection.planHandle) await syncPlanFeatures(tx, connection.clientSiteId)
}

// App Store requirement 1.2.1: a store that came through Shopify, or is being linked from it, pays there.
export const rejectShopifyBilled = (event: H3Event, billingProvider: string | undefined) => {
  if (billingProvider === 'SHOPIFY' || getCookie(event, SHOPIFY_INSTALL_COOKIE))
    throw createError({
      statusCode: 409,
      message: 'This project is billed through Shopify',
      data: { code: 'SHOPIFY_BILLING' },
    })
}

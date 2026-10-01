import type { H3Event } from 'h3'

import { SHOPIFY_INSTALL_COOKIE } from '~~/shared/utils/shopify'
import { nextArticleCreditMonth } from '~~/shared/utils/articleCredits'

import type { DatabaseTransaction } from '../database'

const PARTNER_API_VERSION = '2026-07'
const CHECK_INTERVAL_MS = 5 * 60_000

const SUBSCRIPTION_QUERY = `query TopiquSubscription($appId: ID!, $shopId: ID!) {
  activeSubscription(appId: $appId, shopId: $shopId) {
    billingPeriod
    trialEndsAt
    currentBillingCycle { startTime endTime }
    items { handle }
  }
}`

interface ShopifySubscription {
  billingPeriod: string
  trialEndsAt: string | null
  currentBillingCycle: { startTime: string; endTime: string } | null
  items: { handle: string }[]
}

export const shopifyBillingConfigured = () =>
  Boolean(process.env.SHOPIFY_PARTNER_ORG_ID && process.env.SHOPIFY_PARTNER_API_TOKEN && process.env.SHOPIFY_APP_ID)

// Shopify App Pricing plans are matched by their handle prefix: `pro…` and `premium…`.
export const planFromShopifyHandle = (handle: string): 'PRO' | 'PREMIUM' | null => {
  const value = handle.toLowerCase()
  if (/^premium(?:[-_]|$)/.test(value)) return 'PREMIUM'
  if (/^pro(?:[-_]|$)/.test(value)) return 'PRO'
  return null
}

// Throws on any failure: an outage must never read as "no subscription" and downgrade a paying store.
export const fetchShopifySubscription = async (shopGid: string): Promise<ShopifySubscription | null> => {
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
        query: SUBSCRIPTION_QUERY,
        variables: { appId: `gid://shopify/App/${process.env.SHOPIFY_APP_ID}`, shopId: shopGid },
      }),
    },
  )
  const result = (await response.json().catch(() => null)) as {
    data?: { activeSubscription: ShopifySubscription | null }
    errors?: unknown[]
  } | null
  if (!response.ok || !result?.data || result.errors?.length) throw new Error('Shopify Partner API request failed')
  return result.data.activeSubscription
}

/** Mirrors the store's Shopify App Pricing subscription onto the project plan and article allowance. */
export const syncShopifyPlan = async (connectionId: string, { force = false } = {}) => {
  if (!shopifyBillingConfigured()) return
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

  const subscription = await fetchShopifySubscription(connection.shopGid)
  const handle = subscription?.items.map((item) => item.handle).find((value) => planFromShopifyHandle(value)) ?? null
  const plan = handle ? planFromShopifyHandle(handle) : null
  const { clientSiteId } = connection
  const now = new Date()

  await serializableTransaction(async (tx) => {
    // The uninstall webhook may have handed billing back to Stripe while the Partner API answered.
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

    const annual = subscription.billingPeriod === 'ANNUAL'
    const cycle = subscription.currentBillingCycle
    const trialEndsAt = subscription.trialEndsAt ? new Date(subscription.trialEndsAt) : null
    await tx.clientSite.update({
      where: { id: clientSiteId },
      data: {
        plan,
        billingPlan: annual ? 'ANNUAL' : 'MONTHLY',
        nextBillingAt: cycle ? new Date(cycle.endTime) : trialEndsAt,
        // Shopify owns the trial and renewal lifecycle, like a card-backed Stripe trial.
        firstPaidAt: site.firstPaidAt ?? now,
      },
    })
    await syncPlanFeatures(tx, clientSiteId)

    const periodStart = cycle ? new Date(cycle.startTime) : now
    // Annual plans get monthly allowances; `grant-annual-article-credits` continues from this one.
    const periodEnd = annual
      ? nextArticleCreditMonth(periodStart)
      : cycle
        ? new Date(cycle.endTime)
        : (trialEndsAt ?? nextArticleCreditMonth(periodStart))
    await grantPlanArticleCredits(tx, {
      clientSiteId,
      plan,
      idempotencyKey: `shopify:${connection.shop}:${cycle?.startTime ?? `trial:${subscription.trialEndsAt}`}:${plan}`,
      reason: `${plan} included articles`,
      periodStart,
      periodEnd,
    })
  })
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

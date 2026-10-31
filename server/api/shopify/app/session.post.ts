import type { H3Event } from 'h3'

// App Bridge fetches a fresh ID token and retries once when it sees this header.
const invalidSession = (event: H3Event) => {
  setHeader(event, 'X-Shopify-Retry-Invalid-Session-Request', '1')
  return createError({ statusCode: 401, message: 'Invalid Shopify session' })
}

// `subscribed: false` sends App Home to plan selection; null means unknown or billed outside Shopify.
const subscriptionState = (subscription: object | null | undefined) =>
  subscription === undefined ? null : subscription !== null

// App Home state for the store whose admin is open. The ID token is the only credential here.
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  if (!shopifyConfigured()) throw createError({ statusCode: 503, message: 'Shopify is not configured' })
  const idToken = getHeader(event, 'authorization')?.replace(/^Bearer /, '')
  const session = verifyShopifyIdToken(idToken)
  if (!session || !idToken) throw invalidSession(event)
  const { shop } = session

  const connection = await prisma.shopifyConnection.findUnique({
    where: { shop },
    select: { id: true, status: true, shopGid: true, grantedScopes: true, clientSiteId: true },
  })
  try {
    // Disconnected or uninstalled stores are linked again only through an explicit claim in Topiqu.
    // The plan is chosen before linking: App Pricing bills the store, and a reinstall must ask again.
    if (!connection || connection.status === 'REVOKED') {
      const installation = await pendingShopifyInstallation(shop, idToken)
      const subscription = await fetchShopifySubscription({
        shop,
        shopGid: installation.shopGid,
        accessToken: async () => installation.accessToken,
      }).catch((error) => {
        console.error('SHOPIFY_PLAN_SYNC_FAILED', shop, error)
        return undefined
      })
      const subscribed = subscriptionState(subscription)
      return {
        linked: false,
        linkUrl: `${shopifyOrigin()}/api/shopify/link?code=${signShopifyLink(installation.id)}`,
        subscribed,
        needsPlan: subscribed === false,
        pricingUrl: shopifyPricingUrl(shop),
      }
    }
    // Opening the app is the merchant's consent, so an expired grant or new scopes heal here.
    if (connection.status !== 'CONNECTED' || !connection.shopGid || !shopifyGrantsContent(connection.grantedScopes))
      await prisma.shopifyConnection.update({
        where: { id: connection.id },
        data: {
          ...(await exchangeShopifySession(shop, idToken)),
          status: 'CONNECTED',
          refreshLease: null,
          refreshLeaseUntil: null,
          ...(connection.status === 'CONNECTED' ? {} : { catalogRevision: { increment: 1 } }),
        },
      })
  } catch (error) {
    if (error instanceof ShopifyApiError && error.code === 'REAUTH_REQUIRED') throw invalidSession(event)
    throw createError({ statusCode: 502, message: 'Shopify is temporarily unavailable' })
  }

  // Always fresh: the welcome link after a plan change and a reinstall must both see the current plan.
  const subscription = await syncShopifyPlan(connection.id, { force: true }).catch((error) => {
    console.error('SHOPIFY_PLAN_SYNC_FAILED', shop, error)
    return undefined
  })
  const site = await prisma.clientSite.findUnique({
    where: { id: connection.clientSiteId },
    select: { name: true, plan: true, billingProvider: true },
  })
  if (!site) throw createError({ statusCode: 404, message: 'Project not found' })
  const shopifyBilled = site.billingProvider === 'SHOPIFY'
  return {
    linked: true,
    project: site.name,
    plan: site.plan,
    subscribed: shopifyBilled ? subscriptionState(subscription) : null,
    needsPlan: shopifyBilled && !shopifyEligible(site.plan),
    pricingUrl: shopifyBilled ? shopifyPricingUrl(shop) : null,
  }
})

import type { H3Event } from 'h3'

import { ShopifyApiError } from '../../../utils/shopify/api'
import { syncShopifyPlan } from '../../../utils/shopify/billing'
import { signShopifyLink, verifyShopifyIdToken } from '../../../utils/shopify/security'
import { exchangeShopifySession, pendingShopifyInstallation } from '../../../utils/shopify/installation'
import {
  shopifyConfigured,
  shopifyEligible,
  shopifyGrantsContent,
  shopifyOrigin,
  shopifyPricingUrl,
} from '../../../utils/shopify/config'

// App Bridge fetches a fresh ID token and retries once when it sees this header.
const invalidSession = (event: H3Event) => {
  setHeader(event, 'X-Shopify-Retry-Invalid-Session-Request', '1')
  return createError({ statusCode: 401, message: 'Invalid Shopify session' })
}

// App Home state for the store whose admin is open. The ID token is the only credential here.
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  if (!shopifyConfigured()) throw createError({ statusCode: 503, message: 'Shopify is not configured' })
  const idToken = getHeader(event, 'authorization')?.replace(/^Bearer /, '')
  const session = verifyShopifyIdToken(idToken)
  if (!session || !idToken) throw invalidSession(event)
  const { shop } = session
  const body = await readBody<{ refresh?: unknown } | null>(event).catch(() => null)

  const connection = await prisma.shopifyConnection.findUnique({
    where: { shop },
    select: { id: true, status: true, shopGid: true, grantedScopes: true, clientSiteId: true },
  })
  try {
    // Disconnected or uninstalled stores are linked again only through an explicit claim in Topiqu.
    if (!connection || connection.status === 'REVOKED') {
      const installationId = await pendingShopifyInstallation(shop, idToken)
      return { linked: false, linkUrl: `${shopifyOrigin()}/api/shopify/link?code=${signShopifyLink(installationId)}` }
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

  await syncShopifyPlan(connection.id, { force: body?.refresh === true }).catch((error) =>
    console.error('SHOPIFY_PLAN_SYNC_FAILED', shop, error),
  )
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
    needsPlan: shopifyBilled && !shopifyEligible(site.plan),
    pricingUrl: shopifyBilled ? shopifyPricingUrl(shop) : null,
  }
})

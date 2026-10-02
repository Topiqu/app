import { linkedShopifyInstallation } from '../../utils/shopify/installation'
import {
  shopifyAdminAppUrl,
  shopifyAppStoreUrl,
  shopifyConfigured,
  shopifyEligible,
  shopifyPricingUrl,
} from '../../utils/shopify/config'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, { role: ['admin', 'superadmin'], clientSite: true })
  const db = await getEnhancedPrisma(user)
  const { membership } = await requireTenantMember(event, user.clientSiteId)
  const canManage = hasTenantScope(membership, 'INTEGRATION_CONTROL')
  const canPublish = hasTenantScope(membership, 'ARTICLE_PUBLISH') && hasTenantScope(membership, 'ARTICLE_WRITE')
  const site = await db.clientSite.findUnique({
    where: { id: user.clientSiteId! },
    select: { name: true, plan: true, billingProvider: true, stripeSubscriptionId: true, publishToShopify: true },
  })
  const connection = await db.shopifyConnection.findUnique({
    where: { clientSiteId: user.clientSiteId! },
    select: { shop: true, shopName: true, blogId: true, blogTitle: true, author: true, status: true },
  })
  const pending = canManage ? await linkedShopifyInstallation(event) : null
  const shopifyBilled = site?.billingProvider === 'SHOPIFY'
  return {
    configured: shopifyConfigured(),
    eligible: Boolean(site && shopifyEligible(site.plan)),
    canManage,
    canPublish: canPublish && site?.publishToShopify !== false,
    connection,
    billingProvider: site?.billingProvider ?? 'STRIPE',
    pricingUrl: shopifyBilled && connection ? shopifyPricingUrl(connection.shop) : null,
    adminUrl: connection ? shopifyAdminAppUrl(connection.shop) : null,
    installUrl: shopifyAppStoreUrl(),
    pending: pending
      ? {
          shop: pending.shop,
          shopName: pending.shopName,
          project: site?.name ?? '',
          // Mirrors the claim: a project without a Stripe subscription moves to Shopify billing.
          shopifyBilling: shopifyBilled || (!site?.stripeSubscriptionId && site?.plan !== 'CUSTOM'),
        }
      : null,
  }
})

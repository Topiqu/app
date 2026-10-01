import { syncShopifyPlan } from '../../utils/shopify/billing'
import { clearShopifyLink, linkedShopifyInstallation } from '../../utils/shopify/installation'

// Links the pending installation to the signed-in user's active project. The installation and any
// stale connection are system rows, so this runs on raw prisma; the project comes from the session.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event, { role: ['admin', 'superadmin'], clientSite: true })
  const { membership } = await requireTenantScope(event, 'INTEGRATION_CONTROL', user.clientSiteId)
  const pending = await linkedShopifyInstallation(event)
  if (!pending) throw createError({ statusCode: 403, message: 'The Shopify link has expired. Open Topiqu from Shopify again.' })
  const clientSiteId = user.clientSiteId!
  const site = await prisma.clientSite.findUnique({
    where: { id: clientSiteId },
    select: { plan: true, stripeSubscriptionId: true, billingProvider: true },
  })
  if (!site) throw createError({ statusCode: 404, message: 'Project not found' })
  // Existing Stripe customers keep Stripe; anyone else entering through Shopify pays through Shopify.
  const shopifyBilled = !site.stripeSubscriptionId && site.plan !== 'CUSTOM'
  if (shopifyBilled && site.billingProvider !== 'SHOPIFY' && !hasTenantScope(membership, 'BILLING_CHANGE'))
    throw createError({ statusCode: 403, message: 'Missing tenant scope: BILLING_CHANGE' })

  const connectionId = await prisma.$transaction(async (tx) => {
    const installation = await tx.shopifyInstallation.findUnique({
      where: { id: pending.id },
      select: {
        shop: true,
        shopGid: true,
        shopName: true,
        storefrontUrl: true,
        encryptedAccessToken: true,
        encryptedRefreshToken: true,
        accessTokenExpiresAt: true,
        refreshTokenExpiresAt: true,
        grantedScopes: true,
      },
    })
    const claimed = await tx.shopifyInstallation.deleteMany({ where: { id: pending.id } })
    if (!installation || !claimed.count) throw createError({ statusCode: 409, message: 'The Shopify store was already linked' })
    const { shop } = installation
    const current = await tx.shopifyConnection.findUnique({ where: { clientSiteId }, select: { id: true, shop: true, status: true } })
    const owner = await tx.shopifyConnection.findUnique({ where: { shop }, select: { id: true, clientSiteId: true, status: true } })
    if (current && current.shop !== shop) {
      if (current.status !== 'REVOKED')
        throw createError({ statusCode: 409, message: 'Disconnect the current Shopify store from this project first' })
      await tx.shopifyConnection.delete({ where: { id: current.id } })
    }
    // A store moves only off a project that already disconnected it.
    if (owner && owner.clientSiteId !== clientSiteId) {
      if (owner.status !== 'REVOKED')
        throw createError({ statusCode: 409, message: 'This Shopify store is linked to another Topiqu project' })
      await tx.shopifyConnection.delete({ where: { id: owner.id } })
    }
    const data = {
      shop,
      shopGid: installation.shopGid,
      shopName: installation.shopName,
      storefrontUrl: installation.storefrontUrl,
      encryptedAccessToken: installation.encryptedAccessToken,
      encryptedRefreshToken: installation.encryptedRefreshToken,
      accessTokenExpiresAt: installation.accessTokenExpiresAt,
      refreshTokenExpiresAt: installation.refreshTokenExpiresAt,
      grantedScopes: installation.grantedScopes,
      status: 'CONNECTED' as const,
      refreshLease: null,
      refreshLeaseUntil: null,
      planCheckedAt: null,
    }
    const saved =
      current?.shop === shop
        ? await tx.shopifyConnection.update({
            where: { id: current.id },
            data: { ...data, catalogRevision: { increment: 1 } },
            select: { id: true },
          })
        : await tx.shopifyConnection.create({ data: { clientSiteId, ...data }, select: { id: true } })
    if (shopifyBilled) await tx.clientSite.update({ where: { id: clientSiteId }, data: { billingProvider: 'SHOPIFY' } })
    return saved.id
  })
  clearShopifyLink(event)
  // A reinstall can bring an active Shopify plan along.
  await syncShopifyPlan(connectionId, { force: true }).catch((error) =>
    console.error('SHOPIFY_PLAN_SYNC_FAILED', pending.shop, error),
  )
  return { success: true }
})

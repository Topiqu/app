import { requireShopifyAccess } from '../../utils/shopify/access'

export default defineEventHandler(async (event) => {
  // Disconnecting never needs a paid plan; Shopify billing continues until the app is uninstalled.
  const { db, site } = await requireShopifyAccess(event, 'INTEGRATION_CONTROL', { requirePlan: false })
  await db.$transaction(async (tx) => {
    await tx.shopifyConnection.updateMany({
      where: { clientSiteId: site.id },
      data: {
        status: 'REVOKED',
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        refreshLease: null,
        refreshLeaseUntil: null,
      },
    })
    await tx.shopifyPublication.updateMany({
      where: { clientSiteId: site.id, status: { in: ['QUEUED', 'PUBLISHING'] } },
      data: { status: 'FAILED', lease: null, leaseUntil: null, lastError: 'Shopify disconnected' },
    })
  })
  return { success: true }
})

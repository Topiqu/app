import { requireShopifyAccess } from '../../utils/shopify/access'

export default defineEventHandler(async (event) => {
  const { db, site, user } = await requireShopifyAccess(event)
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
  await prisma.shopifyOAuthAttempt.deleteMany({ where: { clientSiteId: site.id, userId: user.id } })
  return { success: true }
})

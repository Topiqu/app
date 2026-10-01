import { normalizeShopifyShop } from '../../utils/shopify/config'
import { queueShopifyCatalog } from '../../utils/shopify/catalog'
import { releaseShopifyBilling } from '../../utils/shopify/billing'
import { verifyShopifyWebhookHmac } from '../../utils/shopify/security'

export default defineEventHandler(async (event) => {
  const raw = await readRawBody(event, 'utf8')
  if (!raw || !verifyShopifyWebhookHmac(raw, getHeader(event, 'x-shopify-hmac-sha256')))
    throw createError({ statusCode: 401, message: 'Invalid Shopify webhook signature' })
  const shop = normalizeShopifyShop(getHeader(event, 'x-shopify-shop-domain'))
  if (!shop) throw createError({ statusCode: 400, message: 'Invalid Shopify shop' })
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    throw createError({ statusCode: 400, message: 'Invalid Shopify webhook body' })
  }
  const topic = getHeader(event, 'x-shopify-topic')
  if (topic === 'app/uninstalled') {
    if (normalizeShopifyShop(body.myshopify_domain) !== shop)
      throw createError({ statusCode: 400, message: 'Shopify webhook shop mismatch' })
    await prisma.$transaction(async (tx) => {
      await tx.shopifyInstallation.deleteMany({ where: { shop } })
      const connection = await tx.shopifyConnection.findUnique({
        where: { shop },
        select: { id: true, clientSiteId: true, planHandle: true },
      })
      if (!connection) return
      await tx.shopifyConnection.update({
        where: { id: connection.id },
        data: {
          status: 'REVOKED',
          encryptedAccessToken: null,
          encryptedRefreshToken: null,
          refreshLease: null,
          refreshLeaseUntil: null,
        },
      })
      await tx.shopifyPublication.updateMany({
        where: { connectionId: connection.id, status: { in: ['QUEUED', 'PUBLISHING'] } },
        data: { status: 'FAILED', lease: null, leaseUntil: null, lastError: 'Shopify app uninstalled' },
      })
      await releaseShopifyBilling(tx, connection)
    })
  } else if (topic === 'shop/redact') {
    if (normalizeShopifyShop(body.shop_domain) !== shop)
      throw createError({ statusCode: 400, message: 'Shopify webhook shop mismatch' })
    await prisma.$transaction(async (tx) => {
      await tx.shopifyConnection.deleteMany({ where: { shop } })
      await tx.shopifyInstallation.deleteMany({ where: { shop } })
    })
  } else if (
    [
      'products/create',
      'products/update',
      'products/delete',
      'collections/create',
      'collections/update',
      'collections/delete',
      'inventory_levels/update',
      'inventory_items/update',
    ].includes(topic || '')
  ) {
    await queueShopifyCatalog(shop)
  } else if (!['customers/data_request', 'customers/redact'].includes(topic || '')) {
    throw createError({ statusCode: 400, message: 'Unsupported Shopify webhook topic' })
  }
  // This integration neither requests nor stores Shopify customer or order records.
  return { success: true }
})

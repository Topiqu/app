import { shopifyBillingConfigured, syncShopifyPlan } from '../utils/shopify/billing'

// Shopify App Pricing sends no webhooks; cancellations, freezes and renewals are polled.
export default defineMonitoredTask({
  meta: { name: 'shopify-billing', description: 'Syncs Shopify App Pricing subscriptions to project plans' },
  async run() {
    if (!shopifyBillingConfigured()) return { result: { synced: 0, failed: 0 } }
    const connections = await prisma.shopifyConnection.findMany({
      where: { shopGid: { not: null }, clientSite: { billingProvider: 'SHOPIFY' } },
      select: { id: true, shop: true },
    })
    let failed = 0
    for (const connection of connections) {
      try {
        await syncShopifyPlan(connection.id, { force: true })
      } catch (error) {
        failed += 1
        console.error('SHOPIFY_PLAN_SYNC_FAILED', connection.shop, error)
      }
      // The Partner API allows four requests per second per client.
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
    return { result: { synced: connections.length - failed, failed } }
  },
})

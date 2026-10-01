import { queueDirtyShopifyCatalogs } from '../utils/shopify/catalog'

export default defineMonitoredTask({
  meta: { name: 'shopify-catalog', description: 'Queues Shopify catalog changes received during a sync' },
  async run() {
    return { result: { queued: await queueDirtyShopifyCatalogs() } }
  },
})

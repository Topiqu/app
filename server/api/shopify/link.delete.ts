import { clearShopifyLink } from '../../utils/shopify/installation'

export default defineEventHandler((event) => {
  clearShopifyLink(event)
  return { success: true }
})

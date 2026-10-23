export default defineEventHandler((event) => {
  clearShopifyLink(event)
  return { success: true }
})

export default defineEventHandler(async (event) => {
  requireCron(event)
  await runTask('shopify-billing')
  return { success: true }
})

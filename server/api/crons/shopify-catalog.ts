export default defineEventHandler(async (event) => {
  requireCron(event)
  await runTask('shopify-catalog')
  return { success: true }
})

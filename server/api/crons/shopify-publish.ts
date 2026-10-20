export default defineEventHandler(async (event) => {
  requireCron(event)
  await runTask('shopify-publish')
  return { success: true }
})

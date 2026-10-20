export default defineEventHandler(async (event) => {
  requireCron(event)
  await runTask('publish-check')
  return { success: true }
})

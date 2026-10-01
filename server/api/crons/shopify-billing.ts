export default defineEventHandler(async (event) => {
  if (!process.env.CRON_SECRET || getHeader(event, 'Authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  await runTask('shopify-billing')
  return { success: true }
})

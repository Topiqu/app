export default defineEventHandler((event) => {
  clearAnalyticsSession(event)
  return { success: true }
})

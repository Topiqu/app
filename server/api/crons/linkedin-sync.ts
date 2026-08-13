export default defineEventHandler(async (event) => {
  if (getHeader(event, 'Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  // LinkedIn personal-post statistics need restricted read scopes that Topiqu does not hold.
  // Keep this authenticated endpoint as a no-op so an existing scheduler cannot generate 403s.
  // Revive it together with getPostMetrics only after LinkedIn grants the required read access.
  return { success: true, disabled: true, reason: 'linkedin_read_access_not_granted' }
})

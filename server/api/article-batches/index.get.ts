export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'AI_USE')
  if (!user.clientSiteId) throw createError({ statusCode: 403 })
  return articleBatchOverview(user.clientSiteId, await getEnhancedPrisma(user))
})

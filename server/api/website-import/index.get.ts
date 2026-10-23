export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'TENANT_SETTINGS')
  if (!user.clientSiteId) throw createError({ statusCode: 403 })
  return websiteImportView(user.clientSiteId, await getEnhancedPrisma(user))
})

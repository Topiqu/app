export default defineEventHandler(async (event) => {
  const { key } = await requireApiKey(event, 'GENERATE')
  const user = await actAsApiKeyMember(event, key)
  await requireTenantScope(event, 'AI_USE', key.clientSiteId)
  await requireTenantScope(event, 'ARTICLE_WRITE', key.clientSiteId)
  const db = await getEnhancedPrisma(user)
  const id = getRouterParam(event, 'id')
  setResponseHeader(event, 'X-API-Version', '1')

  const generation = id
    ? await db.apiGeneration.findFirst({
        where: { id, clientSiteId: key.clientSiteId },
        select: API_GENERATION_VIEW,
      })
    : null
  if (!generation) throw createError({ statusCode: 404, message: 'Generation not found' })
  return { data: serializeApiGeneration(generation) }
})

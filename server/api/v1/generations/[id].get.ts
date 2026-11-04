export default defineEventHandler(async (event) => {
  const { key } = await requireApiKey(event, 'GENERATE')
  const id = getRouterParam(event, 'id')
  setResponseHeader(event, 'X-API-Version', '1')

  const generation = id
    ? await prisma.apiGeneration.findFirst({
        where: { id, clientSiteId: key.clientSiteId },
        select: API_GENERATION_VIEW,
      })
    : null
  if (!generation) throw createError({ statusCode: 404, message: 'Generation not found' })
  return { data: serializeApiGeneration(generation) }
})

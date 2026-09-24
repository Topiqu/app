export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')
  const id = getRouterParam(event, 'id')
  const current = id
    ? await prisma.mediaAsset.findFirst({ where: { id, clientSiteId: user.clientSiteId!, purgedAt: null } })
    : null
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Media not found' })
  const asset = await prisma.mediaAsset.update({
    where: { id: current.id },
    data: { archivedAt: new Date(), purgeAfter: null },
  })
  return { asset: mediaLibraryAsset(asset) }
})

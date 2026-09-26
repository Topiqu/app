const PURGE_GRACE_MS = 7 * 24 * 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')
  const id = getRouterParam(event, 'id')
  const asset = id
    ? await prisma.mediaAsset.findFirst({ where: { id, clientSiteId: user.clientSiteId!, purgedAt: null } })
    : null
  if (!asset) throw createError({ statusCode: 404, statusMessage: 'Media not found' })
  if (!asset.archivedAt)
    throw createError({ statusCode: 409, statusMessage: 'Archive media before requesting permanent deletion' })
  const references = await findMediaReferences(user.clientSiteId!, asset)
  if (references)
    throw createError({
      statusCode: 409,
      statusMessage: 'Media is still in use',
      data: { code: 'MEDIA_IN_USE', references },
    })
  const purgeAfter = new Date(Date.now() + PURGE_GRACE_MS)
  await prisma.mediaAsset.update({ where: { id: asset.id }, data: { purgeAfter } })
  return { ok: true, purgeAfter }
})

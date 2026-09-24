export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing media id' })
  const asset = await prisma.mediaAsset.findFirst({
    where: { id, clientSiteId: user.clientSiteId!, purgedAt: null },
    include: {
      articleUsages: {
        where: { deletedAt: null },
        include: { article: { select: { id: true, title: true, slug: true, status: true } } },
      },
    },
  })
  if (!asset) throw createError({ statusCode: 404, statusMessage: 'Media not found' })
  const grouped = new Map<string, any>()
  for (const usage of asset.articleUsages) {
    const key = `${usage.articleId}:${usage.language}`
    const current = grouped.get(key)
    if (current) {
      current.placements.push(usage.placement)
      current.occurrenceCount += usage.occurrenceCount
    } else {
      grouped.set(key, {
        articleId: usage.article.id,
        title: usage.article.title,
        slug: usage.article.slug,
        status: usage.article.status,
        language: usage.language,
        placements: [usage.placement],
        occurrenceCount: usage.occurrenceCount,
      })
    }
  }
  const usages = [...grouped.values()]
  return { asset: mediaLibraryAsset(asset, new Set(asset.articleUsages.map((usage) => usage.articleId)).size), usages }
})

export default defineEventHandler(async (event) => {
  const { key } = await requireApiKey(event, 'WRITE')
  const id = getRouterParam(event, 'id')
  const input = await readValidatedBody(event, apiArticleUpdateSchema.parse)
  if (requiresPublishScope(input, true)) requirePublishScope(key)
  await actAsApiKeyMember(event, key)
  setResponseHeader(event, 'X-API-Version', '1')

  return withIdempotency(event, key, { id, ...input }, async () => {
    const current = id
      ? await prisma.article.findFirst({
          where: { id, clientSiteId: key.clientSiteId, deletedAt: null },
          select: { editVersion: true },
        })
      : null
    if (!id || !current) throw createError({ statusCode: 404, message: 'Article not found' })

    const { tags, expectedVersion, ...fields } = input
    // Without `expectedVersion` the write is last-wins against the version read just now.
    await updateArticle(event, id, {
      ...fields,
      ...(tags !== undefined ? { tagIds: await resolveTagSlugs(key.clientSiteId, tags) } : {}),
      expectedVersion: expectedVersion ?? current.editVersion,
    })
    await logApiAction(event, key, 'API_ARTICLE_UPDATED', { articleId: id, fields: Object.keys(input) })
    return { data: await loadOwnedArticleV1(key.clientSiteId, id) }
  })
})

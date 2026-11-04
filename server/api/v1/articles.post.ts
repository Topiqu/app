export default defineEventHandler(async (event) => {
  const { key } = await requireApiKey(event, 'WRITE')
  const input = await readValidatedBody(event, apiArticleCreateSchema.parse)
  if (requiresPublishScope(input, false)) requirePublishScope(key)
  await actAsApiKeyMember(event, key)
  setResponseHeader(event, 'X-API-Version', '1')

  return withIdempotency(event, key, input, async () => {
    const { tags, ...fields } = input
    const article = await createArticle(event, { ...fields, tags: await resolveTagSlugs(key.clientSiteId, tags) })
    await logApiAction(event, key, 'API_ARTICLE_CREATED', { articleId: article.id, status: article.status })
    setResponseStatus(event, 201)
    return { data: await loadOwnedArticleV1(key.clientSiteId, article.id) }
  })
})

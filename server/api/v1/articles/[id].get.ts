export default defineEventHandler(async (event) => {
  const { key } = await requireApiKey(event, 'READ')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing article ID' })
  setResponseHeader(event, 'X-API-Version', '1')

  // A key that can write reads drafts too, so it can follow up on what it created or generated.
  if (key.scopes.includes('WRITE')) {
    const owned = await loadOwnedArticleV1(key.clientSiteId, id)
    if (!owned) throw createError({ statusCode: 404, message: 'Article not found' })
    return { data: owned }
  }

  const article = await prisma.article.findFirst({
    where: { id, clientSiteId: key.clientSiteId, ...publicArticleWhere() },
    select: externalArticleDetailV1Select,
  })
  if (!article) throw createError({ statusCode: 404, message: 'Article not found' })
  return { data: serializeExternalArticleV1(article, article.language) }
})

export default defineEventHandler(async (event) => {
  const clientSite = await requireExternalClient(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing article ID' })

  const article = await prisma.article.findFirst({
    where: { id, clientSiteId: clientSite.id, status: 'published' },
    select: externalArticleDetailV1Select,
  })

  if (!article) throw createError({ statusCode: 404, message: 'Article not found' })

  setResponseHeader(event, 'X-API-Version', '1')
  return { data: serializeExternalArticleV1(article, clientSite.language) }
})

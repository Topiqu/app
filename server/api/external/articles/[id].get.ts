export default defineEventHandler(async (event) => {
  const clientSite = await requireExternalClient(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing article ID' })

  const article = await prisma.article.findFirst({
    where: { id, clientSiteId: clientSite.id, status: 'published' },
    select: externalArticleSelect,
  })

  if (!article) throw createError({ statusCode: 404, message: 'Article not found' })
  return { data: flattenExternalArticle(article, clientSite.language) }
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  const body = await readValidatedBody(event, ArticleUpdateSchema.parse)
  const article = await prisma.article.update({
    where: {
      id,
    },
    data: {
      views: body.views,
    },
  })
  return article
})

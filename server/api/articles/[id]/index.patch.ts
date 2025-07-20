export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const user = (await getServerSession(event))?.user

  if (!user) throw createError({ status: 401 })

  const body = await readValidatedBody(event, ArticleUpdateSchema.parse)
  const article = await prisma.article.update({
    where: {
      id,
    },
    data: {
      title: body.title,
      content: sanitizeHtml(body.content!),
      slug: body.slug,
      userId: body.userId,
      imageUrl: body.imageUrl,
    },
  })
  return article
})

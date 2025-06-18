export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, (data) =>
    ArticleCreateSchema.parse(data),
  )
  const article = await prisma.article.create({
    data: {
      title: body.title,
      content: body.content,
      slug: body.slug,
      userId: body.userId,
      createdAt: new Date(),
      tags: body.tags || [],
    },
  })
  return article
})

import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ status: 401 })

  const body = await readValidatedBody(event, ArticleCreateSchema.parse)
  const article = await prisma.article.create({
    data: {
      title: body.title,
      content: sanitizeHtml(body.content),
      slug: body.slug,
      userId: body.userId,
      createdAt: new Date(),
      imageUrl: body.imageUrl,
    },
  })
  return article
})

import { createError } from 'h3'
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const user = session?.user
  if (!user) throw createError({ status: 401 })

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

import { createError } from 'h3'
import { getServerSession } from '#auth'
import { sanitizeHtml } from '~/server/utils/sanitize'

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user

  if (!user) throw createError({ status: 401 })

  const body = await readValidatedBody(event, ArticleUpdateSchema.parse)
  const article = await prisma.article.update({
    where: {
      id: body.id,
    },
    data: {
      title: body.title,
      content: sanitizeHtml(body.content!),
      slug: body.slug,
      userId: body.userId,
      createdAt: new Date(),
      tags: body.tags || [],
    },
  })
  return article
})

import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const { id: articleId } = event.context.params!

  return await prisma.articleTag.findMany({
    where: { articleId },
    include: { tag: true },
  })
})

import type { H3Event } from 'h3'
export default defineEventHandler(async (event: H3Event) => {
  const { id: articleId } = event.context.params!
  const tagId = event.context.params!.tagId

  return await prisma.articleTag.delete({
    where: { articleId_tagId: { articleId, tagId } },
  })
})

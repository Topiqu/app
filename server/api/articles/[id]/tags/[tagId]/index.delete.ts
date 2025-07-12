import type { H3Event } from 'h3'
import { getServerSession } from '#auth'

export default defineEventHandler(async (event: H3Event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ status: 401 })
  const { id: articleId } = event.context.params!
  const tagId = event.context.params!.tagId

  return await prisma.articleTag.delete({
    where: { articleId_tagId: { articleId, tagId } },
  })
})

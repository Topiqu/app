import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ status: 401 })
  const articleId = event.context.params!.id!
  const tagId = event.context.params!.tagId!

  return await prisma.articleTag.delete({ where: { articleId_tagId: { articleId, tagId } } })
})

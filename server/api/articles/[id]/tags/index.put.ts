import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')
  const articleId = getRouterParam(event, 'id')
  if (!articleId) throw createError({ statusCode: 400, message: 'Missing article id' })
  await requireArticleAccess(event, articleId)
  const { tagIds } = await readValidatedBody(
    event,
    z.object({
      tagIds: z
        .array(z.string().uuid())
        .max(100)
        .transform((ids) => [...new Set(ids)]),
    }).parse,
  )

  const validTags = await prisma.tag.findMany({
    where: { id: { in: tagIds }, clientSiteId: user.clientSiteId },
    select: { id: true },
  })
  if (validTags.length !== tagIds.length) throw createError({ statusCode: 400, message: 'Invalid article tag' })

  await prisma.$transaction(async (tx) => {
    await tx.articleTag.deleteMany({ where: { articleId, tagId: { notIn: tagIds } } })
    if (tagIds.length)
      await tx.articleTag.createMany({ data: tagIds.map((tagId) => ({ articleId, tagId })), skipDuplicates: true })
  })
  return { success: true }
})

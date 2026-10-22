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

  const db = await getEnhancedPrisma(user)
  const changed = await db.$transaction(async (tx) => {
    const [article] = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "Article" WHERE id = ${articleId} AND "clientSiteId" = ${user.clientSiteId!} FOR UPDATE`
    if (!article) throw createError({ statusCode: 404 })
    const existing = await tx.articleTag.findMany({ where: { articleId }, select: { tagId: true } })
    if (existing.length === tagIds.length && existing.every((tag) => tagIds.includes(tag.tagId))) return false
    await tx.$queryRaw`SELECT set_config('topiqu.tags_changed_article_id', ${articleId}, true), set_config('topiqu.actor_id', ${user.id}, true), set_config('topiqu.actor_name', ${user.name}, true)`
    await tx.article.update({
      where: { id: articleId, clientSiteId: user.clientSiteId! },
      data: { editVersion: { increment: 1 } },
    })
    await tx.articleTag.deleteMany({ where: { articleId, tagId: { notIn: tagIds } } })
    if (tagIds.length)
      await tx.articleTag.createMany({ data: tagIds.map((tagId) => ({ articleId, tagId })), skipDuplicates: true })
    return true
  })
  if (changed) await invalidateFeed(user.clientSiteId!)
  return { success: true }
})

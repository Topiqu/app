import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { user, db } = await requireDb(event, { minRole: 'admin', clientSite: true })

  const articleId = event.context.params!.id!
  if (!articleId) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
  await requireArticleAccess(event, articleId)

  const body = await readValidatedBody(event, z.object({ tagId: z.string() }).parse)

  const article = await db.article.findUnique({ where: { id: articleId }, select: { id: true } })
  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

  const tag = await db.tag.findFirst({
    where: { id: body.tagId, clientSiteId: user.clientSiteId },
    select: { id: true },
  })
  if (!tag) throw createError({ statusCode: 404, message: t('common.errors.tagNotFound')! })

  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('topiqu.tags_changed_article_id', ${articleId}, true), set_config('topiqu.actor_id', ${user.id}, true), set_config('topiqu.actor_name', ${user.name}, true)`
    await tx.article.update({
      where: { id: articleId, clientSiteId: user.clientSiteId! },
      data: { editVersion: { increment: 1 } },
    })
    await tx.articleTag.create({ data: { articleId, tagId: tag.id } })
  })
  await invalidateFeed(user.clientSiteId!)
  return { success: true }
})

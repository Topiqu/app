export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { user, db } = await requireDb(event, { minRole: 'admin', clientSite: true })

  const articleId = event.context.params!.id!
  const tagId = event.context.params!.tagId!
  if (!articleId || !tagId) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
  await requireArticleAccess(event, articleId)

  const article = await db.article.findUnique({ where: { id: articleId }, select: { id: true } })
  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('topiqu.tags_changed_article_id', ${articleId}, true), set_config('topiqu.actor_id', ${user.id}, true), set_config('topiqu.actor_name', ${user.name}, true)`
    await tx.article.update({
      where: { id: articleId, clientSiteId: user.clientSiteId! },
      data: { editVersion: { increment: 1 } },
    })
    await tx.articleTag.delete({ where: { articleId_tagId: { articleId, tagId } } })
  })
  await invalidateFeed(user.clientSiteId!)
  return { success: true }
})

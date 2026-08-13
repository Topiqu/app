export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { db } = await requireDb(event, { minRole: 'admin', clientSite: true })

  const articleId = event.context.params!.id!
  const tagId = event.context.params!.tagId!
  if (!articleId || !tagId) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
  await requireArticleAccess(event, articleId)

  const article = await db.article.findUnique({ where: { id: articleId }, select: { id: true } })
  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

  await db.articleTag.delete({ where: { articleId_tagId: { articleId, tagId } } })
  return { success: true }
})

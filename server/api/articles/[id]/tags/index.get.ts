export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { db } = await requireDb(event, { minRole: 'admin', clientSite: true })

  const articleId = getRouterParam(event, 'id')
  if (!articleId) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
  await requireArticleAccess(event, articleId)

  const article = await db.article.findUnique({ where: { id: articleId }, select: { id: true } })
  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

  return await db.articleTag.findMany({
    where: { articleId },
    select: { tagId: true, tag: { select: { id: true, name: true } } },
  })
})

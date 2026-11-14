/** The latest pictures proposed for a saved article, or how far the pick has got. */
export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const access = await requireTenantScope(event, 'ARTICLE_WRITE')
  const { db, article } = await imagePickArticle(event, access, t)
  const pick = await db.articleImagePick.findUnique({ where: { articleId: article.id } })
  if (!pick) throw createError({ statusCode: 404, message: t('common.errors.notFound')! })
  return imagePickView(pick, t)
})

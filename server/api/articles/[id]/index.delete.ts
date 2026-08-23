export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { user, membership } = await requireTenantScope(event, 'ARTICLE_WRITE')
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const db = await getEnhancedPrisma(user)
  const article = await db.article.findUnique({ where: { id }, select: { userId: true } })
  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })
  if (article.userId !== user.id && !hasTenantScope(membership, 'ARTICLE_WRITE_OTHERS'))
    throw createError({ statusCode: 403, message: t('common.errors.articleEditForbidden')! })
  const deleted = await db.article.delete({ where: { id } })
  if (deleted.status === 'published') await invalidateFeed(deleted.clientSiteId)
  return { success: true }
})

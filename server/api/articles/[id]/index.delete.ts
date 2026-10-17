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
  // Read first: translations cascade away with the article.
  const removedPaths = await articlePublicPaths(id, user.clientSiteId!)
  const deleted = await db.article.delete({ where: { id } })
  try {
    await logAction({
      action: 'ARTICLE_DELETED',
      userId: user.id,
      clientSiteId: deleted.clientSiteId,
      ip: getIp(event),
      metadata: { articleId: id, title: deleted.title, status: deleted.status },
    })
  } catch (error) {
    await reportCaughtError('Article deletion audit logging failed', error, {
      articleId: id,
      clientSiteId: deleted.clientSiteId,
    }).catch(() => undefined)
  }
  if (deleted.status === 'published') {
    await invalidateFeed(deleted.clientSiteId)
    await enqueueArticleWebhook('ARTICLE_DELETED', deleted)
  }
  void announceArticle(deleted.id, deleted.clientSiteId, removedPaths)
  return { success: true }
})

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await getSessionUser(event)
  if (!user || user.role !== 'admin') throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  await requireTenantScope(event, 'CONTENT_MODERATE', user.clientSiteId)

  const commentId = getRouterParam(event, 'id')
  if (!commentId) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const db = await getEnhancedPrisma(user)
  const comment = await db.comment.findUnique({
    where: { id: commentId },
    select: {
      userId: true,
      article: { select: { clientSiteId: true } },
    },
  })

  if (!comment) throw createError({ statusCode: 404, message: t('common.errors.commentNotFound')! })

  if (user.clientSiteId !== comment.article.clientSiteId)
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const activeBan = await db.userBan.findFirst({
    where: {
      userId: comment.userId,
      clientSiteId: comment.article.clientSiteId,
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  })

  if (!activeBan) throw createError({ statusCode: 404, message: t('common.errors.banNotFound')! })

  await db.userBan.update({
    where: { id: activeBan.id },
    data: { deletedAt: new Date() },
  })

  return { success: true }
})

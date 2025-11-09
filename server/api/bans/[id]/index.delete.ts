export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user || user.role !== 'admin') throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const commentId = getRouterParam(event, 'id')
  if (!commentId) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      userId: true,
      article: { select: { clientSiteId: true } },
    },
  })

  if (!comment) throw createError({ statusCode: 404, message: t('common.errors.commentNotFound')! })

  if (user.clientSiteId !== comment.article.clientSiteId)
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const activeBan = await prisma.userBan.findFirst({
    where: {
      userId: comment.userId,
      clientSiteId: comment.article.clientSiteId,
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  })

  if (!activeBan) throw createError({ statusCode: 404, message: t('common.errors.banNotFound')! })

  await prisma.userBan.update({
    where: { id: activeBan.id },
    data: { deletedAt: new Date() },
  })

  return { success: true }
})

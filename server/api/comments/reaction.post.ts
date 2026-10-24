export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const body = await readValidatedBody(event, CommentReactionSchema.omit({ userId: true }).parse)

  const db = await getEnhancedPrisma(user)
  const comment = await db.comment.findUnique({
    where: { id: body.commentId, deletedAt: null },
    select: {
      id: true,
      userId: true,
      deletedAt: true,
      article: {
        select: {
          clientSiteId: true,
          status: true,
          deletedAt: true,
          releaseAt: true,
          allowedComments: true,
          clientSite: { select: { deletedAt: true, commentsEnabled: true } },
        },
      },
    },
  })
  if (!comment || comment.deletedAt || !canReadArticle(user, comment.article))
    throw createError({ statusCode: 404, message: t('common.errors.commentNotFound')! })
  if (!comment.article.allowedComments || !comment.article.clientSite.commentsEnabled)
    throw createError({ statusCode: 403, message: t('common.errors.commentsDisabled')! })
  const ban = await db.userBan.findFirst({
    where: {
      userId: user.id,
      clientSiteId: comment.article.clientSiteId,
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  })
  if (ban) throw createError({ statusCode: 403, message: t('articles.comments.postingBanned')! })

  const where = { userId_commentId: { userId: user.id, commentId: body.commentId } }
  const existing = await db.commentReaction.findUnique({ where, select: { type: true } })

  // Same type toggles off; the other type switches, which the client already shows optimistically.
  if (existing?.type === body.type) {
    await db.commentReaction.delete({ where })
    const count = await db.commentReaction.count({ where: { commentId: body.commentId } })
    return { liked: false, likes: count }
  }

  if (existing) await db.commentReaction.update({ where, data: { type: body.type } })
  else await db.commentReaction.create({ data: { commentId: body.commentId, userId: user.id, type: body.type } })

  if (body.type === 'LIKE' && comment.userId && comment.userId !== user.id) {
    try {
      await prisma.notification.create({
        data: {
          message: t('common.notifications.userLikedComment', { user: user.name || 'Anonymous' })!,
          userId: comment.userId,
          type: 'LIKE',
        },
      })
    } catch (error) {
      await reportCaughtError('Comment reaction notification failed after persistence', error, {
        commentId: comment.id,
      })
    }
  }

  const count = await db.commentReaction.count({ where: { commentId: body.commentId } })
  return { liked: true, likes: count }
})

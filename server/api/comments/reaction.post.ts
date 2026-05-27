export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const body = await readValidatedBody(event, CommentReactionSchema.omit({ userId: true }).parse)

  const db = await getEnhancedPrisma(user)
  const comment = await db.comment.findUnique({
    where: { id: body.commentId, deletedAt: null },
    select: { id: true, userId: true },
  })
  if (!comment) throw createError({ statusCode: 404, message: t('common.errors.commentNotFound')! })

  const where = { commentId: body.commentId, userId: user.id }

  const exists = await db.commentReaction.findFirst({ where })

  if (exists) {
    await db.commentReaction.deleteMany({ where })
    const count = await db.commentReaction.count({ where: { commentId: body.commentId } })
    return { liked: false, likes: count }
  }

  await db.commentReaction.create({
    data: {
      commentId: body.commentId,
      userId: user.id,
      type: body.type,
    },
  })

  if (body.type === 'LIKE' && comment.userId && comment.userId !== user.id) {
    await prisma.notification.create({
      data: {
        message: t('notifications.userLikedComment', { user: user.name || 'Anonymous' })!,
        userId: comment.userId,
        type: 'LIKE',
      },
    })
  }

  const count = await db.commentReaction.count({ where: { commentId: body.commentId } })
  return { liked: true, likes: count }
})

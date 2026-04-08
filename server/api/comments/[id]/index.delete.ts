export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  const db = await getEnhancedPrisma(user)

  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const commentId = getRouterParam(event, 'id')
  if (!commentId) throw createError({ statusCode: 400, message: t('common.errors.commentIdRequired')! })

  const comment = await db.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      userId: true,
      content: true,
      articleId: true,
      user: { select: { email: true, username: true, allowEmail: true } },
      article: { select: { clientSiteId: true } },
    },
  })

  if (!comment) throw createError({ statusCode: 404, message: t('common.errors.commentNotFound')! })

  const isOwner = comment.userId === user.id
  const isAdmin = user.role === 'admin' && user.clientSiteId === comment.article.clientSiteId

  if (!isOwner && !isAdmin) throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const { reason } = await readBody(event)
  const deleteReason = reason?.trim() || t('common.user.violateRules')!

  await db.comment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  })

  if (comment.user.email && isAdmin && !isOwner && comment.user.allowEmail) {
    await sendEmail({
      event,
      to: comment.user.email,
      template: 'deleteComment',
      data: {
        userName: comment.user.username,
        commentContent: comment.content.slice(0, 50) + (comment.content.length > 50 ? '...' : ''),
        deleteReason,
        logoUrl: 'https://cdn.topiqu.com/app-logo.png',
        unsubscribeUrl: `${useRuntimeConfig().public.baseUrl}/unsubscribe?email=${comment.user.email}`,
      },
    })
  }

  return { message: t('common.messages.successGeneral')! }
})

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const db = await getEnhancedPrisma(user)

  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const commentId = getRouterParam(event, 'id')
  if (!commentId) throw createError({ statusCode: 400, message: 'Chybí ID komentáře' })

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
  if (!comment) throw createError({ statusCode: 404, message: 'Komentář nenalezen' })

  if (comment.userId !== user.id && !(user.role === 'admin' && user.clientSiteId === comment.article.clientSiteId))
    throw createError({ statusCode: 403, message: 'Nemáte oprávnění smazat tento komentář' })

  const { reason } = await readBody(event)
  const deleteReason = reason?.trim() || 'porušení pravidel komunity'

  await db.comment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  })

  if (comment.user.email && user.role === 'admin' && comment.userId !== user.id && comment.user.allowEmail) {
    await sendEmail({
      event,
      to: comment.user.email,
      template: 'deleteComment',
      data: {
        userName: comment.user.username,
        commentContent: comment.content.slice(0, 50) + (comment.content.length > 50 ? '...' : ''),
        deleteReason,
        logoUrl: 'https://via.placeholder.com/150x50',
        unsubscribeUrl: `${useRuntimeConfig().public.baseUrl}/unsubscribe?email=${comment.user.email}`,
      },
    })
  }

  return { message: 'Komentář smazán' }
})

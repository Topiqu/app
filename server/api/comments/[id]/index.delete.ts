export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const db = await getEnhancedPrisma(user)

  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const commentId = getRouterParam(event, 'id')
  if (!commentId) throw createError({ statusCode: 400, message: 'Chybí ID komentáře' })

  const comment = await db.comment.findUnique({
    where: { id: commentId },
  })
  if (!comment) throw createError({ statusCode: 404, message: 'Komentář nenalezen' })

  if (comment.userId !== user.id)
    throw createError({
      statusCode: 403,
      message: 'Nemáte oprávnění smazat tento komentář',
    })

  await db.comment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  })

  return { message: 'Komentář smazán' }
})

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user)
    throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })

  const commentId = getRouterParam(event, 'id')
  if (!commentId)
    throw createError({ statusCode: 400, statusMessage: 'Chybí ID komentáře' })

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  })
  if (!comment)
    throw createError({ statusCode: 404, statusMessage: 'Komentář nenalezen' })

  if (comment.userId !== user.id)
    throw createError({
      statusCode: 403,
      statusMessage: 'Nemáte oprávnění smazat tento komentář',
    })

  await prisma.comment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  })

  return { message: 'Komentář smazán' }
})

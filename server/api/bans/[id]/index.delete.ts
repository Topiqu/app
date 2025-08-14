export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user || user.role !== 'admin') throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const commentId = getRouterParam(event, 'id')
  if (!commentId) throw createError({ statusCode: 400, message: 'Chybí ID komentáře' })

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      userId: true,
      article: { select: { clientSiteId: true } },
    },
  })
  if (!comment) throw createError({ statusCode: 404, message: 'Komentář nenalezen' })

  if (user.clientSiteId !== comment.article.clientSiteId) {
    throw createError({ statusCode: 403, message: 'Nemáte oprávnění pro tento clientSite' })
  }

  const activeBan = await prisma.userBan.findFirst({
    where: {
      userId: comment.userId,
      clientSiteId: comment.article.clientSiteId,
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  })
  if (!activeBan) throw createError({ statusCode: 404, message: 'Aktivní ban nenalezen' })

  await prisma.userBan.update({
    where: { id: activeBan.id },
    data: { deletedAt: new Date() },
  })

  return { success: true }
})

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  // const db = await getEnhancedPrisma(user)
  const body = await readBody(event)
  if (!body.commentId) throw createError({ statusCode: 400, message: 'Neplatný požadavek' })

  const comment = await prisma.comment.findUnique({
    where: { id: body.commentId },
    select: {
      id: true,
      content: true,
      articleId: true,
      article: { select: { clientSiteId: true, slug: true, title: true, userId: true } },
    },
  })
  if (!comment) throw createError({ statusCode: 404, message: 'Komentář nenalezen' })

  const admin = await prisma.user.findUnique({
    where: { role: 'admin', id: comment.article.userId, clientSiteId: comment.article.clientSiteId, allowNotifs: true },
    select: { id: true, email: true, username: true },
  })
  if (!admin) throw createError({ statusCode: 404, message: 'Admin nenalezen' })

  await prisma.notification.create({
    data: {
      message: `${user.name} nahlásil komentář k článku: ${comment.article.title}`,
      userId: admin.id,
      articleId: comment.articleId,
      type: 'SYSTEM',
    },
  })

  return { message: 'Komentář nahlášen' }
})

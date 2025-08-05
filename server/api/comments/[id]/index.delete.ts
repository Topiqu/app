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
      user: { select: { email: true, username: true } },
      article: { select: { clientSiteId: true } },
    },
  })
  if (!comment) throw createError({ statusCode: 404, message: 'Komentář nenalezen' })

  if (comment.userId !== user.id && !(user.role === 'admin' && user.clientSiteId === comment.article.clientSiteId))
    throw createError({ statusCode: 403, message: 'Nemáte oprávnění smazat tento komentář' })

  const { reason } = await readBody(event)
  const deleteReason = reason?.trim()

  await db.comment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  })

  if (comment.user.email && user.role === 'admin' && comment.userId !== user.id) {
    const t = useNodeMailer()
    await t.sendMail({
      from: useRuntimeConfig().from,
      to: comment.user.email,
      subject: 'Váš komentář byl smazán',
      text: `Ahoj ${comment.user.username},\nVáš komentář "${comment.content.slice(0, 50)}..." byl smazán${reason ? ` z důvodu: ${deleteReason}` : ' z důvodu porušení pravidel komunity'}.`,
      html: `<p>Ahoj <b>${comment.user.username}</b>,<br>Váš komentář "<b>${comment.content.slice(0, 50)}...</b>" byl smazán${reason ? ` z důvodu: ${deleteReason}` : ' z důvodu porušení pravidel komunity'}.</p>`,
    })
  }

  return { message: 'Komentář smazán' }
})

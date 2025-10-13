export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const db = await getEnhancedPrisma(user)

  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  if (user.role !== 'admin' || !user.clientSiteId)
    throw createError({ statusCode: 403, message: 'Nemáte oprávnění banovat uživatele' })

  const commentId = getRouterParam(event, 'id')
  if (!commentId) throw createError({ statusCode: 400, message: 'Chybí ID komentáře' })

  const comment = await db.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      userId: true,
      content: true,
      article: { select: { clientSiteId: true } },
      user: { select: { email: true, username: true, allowEmail: true } },
    },
  })
  if (!comment) throw createError({ statusCode: 404, message: 'Komentář nenalezen' })

  if (user.clientSiteId !== comment.article.clientSiteId)
    throw createError({ statusCode: 403, message: 'Nemáte oprávnění banovat uživatele na této subdoméně' })

  const { reason, expiresAt } = await readBody(event)
  if (!reason?.trim()) throw createError({ statusCode: 400, message: 'Důvod banu je povinný' })

  const existingBan = await db.userBan.findFirst({
    where: {
      userId: comment.userId,
      clientSiteId: comment.article.clientSiteId,
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  })

  if (existingBan) {
    throw createError({ statusCode: 409, message: 'Uživatel je již zabanován na této subdoméně' })
  }

  const softDeletedBan = await db.userBan.findFirst({
    where: {
      userId: comment.userId,
      clientSiteId: comment.article.clientSiteId,
      deletedAt: { not: null },
    },
  })

  if (softDeletedBan) {
    await db.userBan.update({
      where: { id: softDeletedBan.id },
      data: {
        reason: reason.trim(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        deletedAt: null,
        bannedById: user.id,
      },
    })
  } else {
    await db.userBan.create({
      data: {
        userId: comment.userId,
        clientSiteId: comment.article.clientSiteId,
        reason: reason.trim(),
        bannedById: user.id,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    })
  }

  if (comment.user.email && comment.user.allowEmail) {
    const t = useNodeMailer()
    await t.sendMail({
      from: useRuntimeConfig().from,
      to: comment.user.email,
      text: `Ahoj ${comment.user.username},\nVáš účet byl zabanován na subdoméně ${comment.article.clientSiteId}${reason ? ` z důvodu: ${reason}` : ''}${expiresAt ? ` do ${new Date(expiresAt).toLocaleString('cs-CZ')}` : ''}.`,
      html: `<p>Ahoj <b>${comment.user.username}</b>,<br>Váš účet byl zabanován na subdoméně <b>${comment.article.clientSiteId}</b>${reason ? ` z důvodu: ${reason}` : ''}${expiresAt ? ` do ${new Date(expiresAt).toLocaleString('cs-CZ')}` : ''}.</p>`,
    })
  }

  return { message: 'Uživatel zabanován' }
})

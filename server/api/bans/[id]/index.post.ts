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
    const lang = (getCookie(event, 'i18n_lang') || 'en') as 'cs' | 'en'
    const banDuration = expiresAt
      ? new Date(expiresAt).toLocaleString(lang === 'cs' ? 'cs-CZ' : 'en-US')
      : lang === 'cs'
        ? 'trvale'
        : 'permanently'
    const introKey = reason
      ? banDuration === (lang === 'cs' ? 'trvale' : 'permanently')
        ? 'intro_with_reason_permanent'
        : 'intro_with_reason_temporary'
      : 'intro_no_reason'
    await sendEmail({
      event,
      to: comment.user.email,
      template: 'userBan',
      lang,
      data: {
        userName: comment.user.username,
        clientSiteId: comment.article.clientSiteId,
        reason: reason.trim(),
        banDuration,
        introKey,
        logoUrl: 'https://via.placeholder.com/150x50',
        unsubscribeUrl: `${useRuntimeConfig().public.baseUrl}/unsubscribe?email=${comment.user.email}`,
      },
    })
  }

  return { message: 'Uživatel zabanován' }
})

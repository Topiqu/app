export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const { title, excerpt, content } = await readBody(event)
  if (!title && !content && content !== '<p></p>' && !excerpt)
    throw createError({ statusCode: 400, message: 'Alespoň jedno pole (title, excerpt, content) musí být vyplněno' })
  if (!user.clientSiteId) throw createError({ statusCode: 400, message: 'Chybí clientSiteId' })

  const clientSite = await prisma.clientSite.findUnique({ where: { id: user.clientSiteId } })
  if (!clientSite || clientSite.id !== user.clientSiteId)
    throw createError({ statusCode: 403, message: 'Neoprávněný přístup k clientSite' })

  const draft = await prisma.articleDraft.create({
    data: {
      title: title || '',
      excerpt: excerpt || null,
      content: content || '',
      userId: user.id,
      clientSiteId: user.clientSiteId,
    },
    select: { id: true, title: true, excerpt: true, content: true, createdAt: true, updatedAt: true },
  })

  return { success: true, draft }
})

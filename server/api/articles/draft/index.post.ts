export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const { title, excerpt, content, imageUrl } = await readBody(event)

  if (!title && !content && content !== '<p></p>' && !excerpt)
    throw createError({ statusCode: 400, message: t('common.errors.missing')! })
  if (!user.clientSiteId) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const clientSite = await prisma.clientSite.findUnique({ where: { id: user.clientSiteId } })
  if (!clientSite || clientSite.id !== user.clientSiteId)
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const draft = await prisma.articleDraft.create({
    data: {
      title: title || '',
      excerpt: excerpt || null,
      content: content || '',
      imageUrl: imageUrl || null,
      userId: user.id,
      clientSiteId: user.clientSiteId,
    },
    select: {
      id: true,
      title: true,
      excerpt: true,
      content: true,
      imageUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return { success: true, draft }
})

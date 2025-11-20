export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  if (!user.clientSiteId) throw createError({ statusCode: 403, message: t('common.errors.missing')! })

  const topLiked = await prisma.article.findFirst({
    where: {
      clientSiteId: user.clientSiteId,
      status: 'published',
    },
    select: {
      id: true,
      title: true,
      _count: { select: { reactions: true } },
    },
    orderBy: { reactions: { _count: 'desc' } },
    take: 1,
  })

  if (!topLiked) return null

  return {
    id: topLiked.id,
    title: topLiked.title,
    likes: topLiked._count.reactions,
  }
})

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  const slug = getRouterParam(event, 'id')
  if (!slug) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const sessionId = getCookie(event, 'anon_session')
  const { clientSiteId } = getQuery<{ clientSiteId: string }>(event)
  const article = await prisma.article.findUnique({
    where: { slug_clientSiteId: { slug, clientSiteId } },
    include: {
      user: {
        select: {
          username: true,
          id: true,
          email: true,
          avatarUrl: true,
          _count: { select: { following: true } },
        },
      },
      tags: { include: { tag: true } },
      reactions: true,
      _count: {
        select: {
          comments: { where: { deletedAt: null } },
          reactions: true,
        },
      },
    },
  })
  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

  if (article.status !== 'published' && user?.role !== 'admin')
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  return {
    ...article,
    commentCount: article._count.comments,
    likes: article._count.reactions,
    likedByUser: user?.id
      ? article.reactions.some((r) => r.userId === user.id)
      : sessionId
        ? article.reactions.some((r) => r.sessionId === sessionId)
        : false,
    followerCount: article.user?._count.following ?? 0,
  }
})

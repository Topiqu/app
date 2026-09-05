export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { id } = getRouterParams(event)
  const userData = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      bio: true,
      createdAt: true,
      role: true,
      clientSiteId: true,
      _count: { select: { comments: true, followers: true, following: true } },
    },
  })

  if (!userData) throw createError({ statusCode: 404, message: t('common.errors.userNotFound')! })

  const articleWhere = {
    userId: userData.id,
    clientSiteId: userData.clientSiteId ?? undefined,
    status: 'published' as const,
  }
  const [articleStats, totalArticleLikes] = await Promise.all([
    prisma.article.aggregate({ where: articleWhere, _count: { id: true }, _sum: { views: true } }),
    prisma.articleReaction.count({ where: { article: articleWhere } }),
  ])

  return {
    id: userData.id,
    username: userData.username,
    avatarUrl: userData.avatarUrl,
    bio: userData.bio,
    joinedAt: userData.createdAt,
    roleLabel: userData.role === 'reader' ? 'Reader' : 'Author',
    articleCount: articleStats._count.id,
    followerCount: userData._count.followers,
    followingCount: userData._count.following,
    commentCount: userData._count.comments,
    totalArticleViews: articleStats._sum.views ?? 0,
    totalArticleLikes,
  }
})

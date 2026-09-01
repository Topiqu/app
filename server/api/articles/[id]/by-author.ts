export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  const sessionId = user?.id ? null : readAnonSession(event)
  const username = decodeURIComponent(getRouterParam(event, 'id')!.trim())
  if (!username) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const { skip, take } = await getPagination(event)
  const query = getQuery(event)
  const { search = '', sort = 'createdAt:desc' } = query as { search?: string; sort?: string }

  const db = await getEnhancedPrisma(user)

  const author = await db.user.findUnique({
    where: { username },
    select: { id: true, username: true, avatarUrl: true, bio: true, clientSiteId: true },
  })
  if (!author) throw createError({ statusCode: 404, message: t('common.errors.authorNotFound')! })

  const [field, order] = (sort as string).split(':') as ['createdAt' | 'title', 'asc' | 'desc']

  const visibleWhere = {
    userId: author.id,
    status:
      (user?.role === 'admin' && user?.clientSiteId == author.clientSiteId) || user?.role === 'superadmin'
        ? undefined
        : ('published' as const),
  }

  const publicWhere = {
    userId: author.id,
    clientSiteId: author.clientSiteId ?? undefined,
    status: 'published' as const,
  }
  const [articles, total, counts, stats, totalArticleLikes] = await Promise.all([
    db.article.findMany({
      where: {
        ...visibleWhere,
        ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
      },
      take: take + 1,
      skip,
      orderBy: { [field]: order },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        tags: { include: { tag: true } },
        reactions: {
          where: user?.id ? { userId: user.id } : sessionId ? { sessionId, userId: null } : { id: '' },
          select: { id: true },
          take: 1,
        },
        _count: { select: { reactions: true } },
      },
      omit: { content: true },
    }),
    db.article.count({ where: visibleWhere }),
    db.user.findUnique({
      where: { id: author.id },
      select: { createdAt: true, role: true, _count: { select: { comments: true, followers: true, following: true } } },
    }),
    db.article.aggregate({ where: publicWhere, _count: { id: true }, _sum: { views: true } }),
    db.articleReaction.count({ where: { article: publicWhere } }),
  ])

  const hasMore = articles.length > take
  const items = hasMore ? articles.slice(0, take) : articles

  return {
    id: author.id,
    username: author.username,
    avatarUrl: author.avatarUrl,
    bio: author.bio,
    joinedAt: counts!.createdAt,
    roleLabel: counts!.role === 'reader' ? 'Reader' : 'Author',
    articleCount: stats._count.id,
    followerCount: counts!._count.followers,
    followingCount: counts!._count.following,
    commentCount: counts!._count.comments,
    totalArticleViews: stats._sum.views ?? 0,
    totalArticleLikes,
    articles: items.map(({ reactions, ...article }) => ({
      articleId: article.id,
      article: {
        ...article,
        likes: article._count.reactions,
        likedByUser: reactions.length > 0,
        views: article.views,
      },
    })),
    hasMore,
    total,
  }
})

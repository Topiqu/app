export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const db = await getEnhancedPrisma(user)
  const query = getQuery(event)
  const sort = typeof query.sort === 'string' ? query.sort : 'createdAt:desc'
  const [sortField, sortOrder] = sort.split(':') as ['createdAt' | 'likes', 'asc' | 'desc']
  const { skip, take } = await getPagination(event)
  const adjustedTake = Math.max(0, Math.min(take, 5))

  // Query articles directly so read policies apply before counting and pagination.
  // A readable reaction can otherwise include a null article when access to it is denied.
  const likedArticlesWhere = { reactions: { some: { userId: user.id } } }
  const likedArticlesCount = await db.article.count({ where: likedArticlesWhere })
  const likedArticles = await db.article.findMany({
    where: likedArticlesWhere,
    skip,
    take: adjustedTake,
    orderBy: sortField === 'likes' ? { reactions: { _count: sortOrder } } : { createdAt: sortOrder },
    select: {
      id: true,
      slug: true,
      language: true,
      title: true,
      content: true,
      excerpt: true,
      imageUrl: true,
      createdAt: true,
      views: true,
      user: { select: { username: true, avatarUrl: true } },
      tags: { select: { tag: { select: { name: true } } } },
      reactions: { select: { id: true } },
    },
  })

  const commentsCount = await db.comment.count({ where: { userId: user.id, parentId: null, deletedAt: null } })
  const comments = await db.comment.findMany({
    where: { userId: user.id, parentId: null, deletedAt: null },
    skip,
    take: adjustedTake,
    orderBy: sortField === 'likes' ? { reactions: { _count: sortOrder } } : { createdAt: sortOrder },
    include: {
      article: {
        select: {
          slug: true,
          language: true,
          title: true,
          views: true,
          tags: { select: { tag: { select: { name: true } } } },
        },
      },
      user: { select: { username: true, avatarUrl: true } },
      reactions: { select: { type: true } },
      replies: {
        include: {
          article: {
            select: {
              slug: true,
              language: true,
              title: true,
              views: true,
              tags: { select: { tag: { select: { name: true } } } },
            },
          },
          user: { select: { username: true, avatarUrl: true } },
          reactions: { select: { type: true } },
        },
      },
    },
  })

  return {
    likedArticles: likedArticles.map((article) => ({
      id: article.id,
      slug: article.slug,
      language: article.language,
      title: article.title,
      content: article.content,
      excerpt: article.excerpt || '',
      imageUrl: article.imageUrl,
      createdAt: article.createdAt?.toISOString() || null,
      authorUsername: article.user?.username || 'Anonym',
      authorPfp: article.user?.avatarUrl || null,
      views: article.views,
      tags: article.tags.map((t) => t.tag.name),
      likesCount: article.reactions.length,
    })),
    comments: comments.map((c) => ({
      id: c.id,
      content: c.content,
      articleSlug: c.article?.slug || '',
      articleLanguage: c.article?.language,
      articleTitle: c.article?.title || '',
      authorUsername: c.user?.username || 'Anonym',
      userId: c.userId,
      authorPfp: c.user?.avatarUrl || null,
      tags: c.article?.tags.map((t) => t.tag.name) || [],
      createdAt: c.createdAt.toISOString(),
      likesCount: c.reactions.filter((r) => r.type === 'LIKE').length,
      dislikesCount: c.reactions.filter((r) => r.type === 'DISLIKE').length,
      parentId: c.parentId || null,
      replies: c.replies.map((reply) => ({
        id: reply.id,
        content: reply.content,
        articleSlug: reply.article?.slug || '',
        articleLanguage: reply.article?.language,
        articleTitle: reply.article?.title || '',
        authorUsername: reply.user?.username || 'Anonym',
        userId: reply.userId,
        authorPfp: reply.user?.avatarUrl || null,
        tags: reply.article?.tags.map((t) => t.tag.name) || [],
        createdAt: reply.createdAt.toISOString(),
        likesCount: reply.reactions.filter((r) => r.type === 'LIKE').length,
        dislikesCount: reply.reactions.filter((r) => r.type === 'DISLIKE').length,
        parentId: reply.parentId || null,
        deletedAt: reply.deletedAt?.toISOString() || null,
      })),
      deletedAt: c.deletedAt?.toISOString() || null,
    })),
    hasMore: {
      likedArticles: skip + likedArticles.length < likedArticlesCount,
      comments: skip + comments.length < commentsCount,
    },
  }
})

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const db = await getEnhancedPrisma(user)
  const query = getQuery(event)
  const sort = typeof query.sort === 'string' ? query.sort : 'createdAt:desc'
  const [sortField, sortOrder] = sort.split(':') as ['createdAt' | 'likes', 'asc' | 'desc']
  const { skip, take } = await getPagination(event)
  const adjustedTake = Math.max(0, Math.min(take, 5))

  const likedArticlesCount = await db.articleReaction.count({ where: { userId: user.id } })
  const likedArticles = await db.articleReaction.findMany({
    where: { userId: user.id },
    skip,
    take: adjustedTake,
    orderBy:
      sortField === 'likes' ? { article: { reactions: { _count: sortOrder } } } : { article: { createdAt: sortOrder } },
    include: {
      article: {
        select: {
          id: true,
          slug: true,
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
      },
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
        select: { slug: true, title: true, views: true, tags: { select: { tag: { select: { name: true } } } } },
      },
      user: { select: { username: true, avatarUrl: true } },
      reactions: { select: { type: true } },
      replies: {
        include: {
          article: {
            select: { slug: true, title: true, views: true, tags: { select: { tag: { select: { name: true } } } } },
          },
          user: { select: { username: true, avatarUrl: true } },
          reactions: { select: { type: true } },
        },
      },
    },
  })

  return {
    likedArticles: likedArticles.map((reaction) => ({
      id: reaction.article.id,
      slug: reaction.article.slug,
      title: reaction.article.title,
      content: reaction.article.content,
      excerpt: reaction.article.excerpt || '',
      imageUrl: reaction.article.imageUrl,
      createdAt: reaction.article.createdAt?.toISOString() || null,
      authorUsername: reaction.article.user?.username || 'Anonym',
      authorPfp: reaction.article.user?.avatarUrl || null,
      views: reaction.article.views,
      tags: reaction.article.tags.map((t) => t.tag.name),
      likesCount: reaction.article.reactions.length,
    })),
    comments: comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      articleSlug: comment.article?.slug || '',
      articleTitle: comment.article?.title || '',
      authorUsername: comment.user?.username || 'Anonym',
      userId: comment.userId,
      authorPfp: comment.user?.avatarUrl || null,
      tags: comment.article?.tags.map((t) => t.tag.name) || [],
      createdAt: comment.createdAt.toISOString(),
      likesCount: comment.reactions.filter((r) => r.type === 'LIKE').length,
      dislikesCount: comment.reactions.filter((r) => r.type === 'DISLIKE').length,
      parentId: comment.parentId || null,
      replies: comment.replies.map((reply) => ({
        id: reply.id,
        content: reply.content,
        articleSlug: reply.article?.slug || '',
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
      deletedAt: comment.deletedAt?.toISOString() || null,
    })),
    hasMore: {
      likedArticles: skip + likedArticles.length < likedArticlesCount,
      comments: skip + comments.length < commentsCount,
    },
  }
})

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const db = await getEnhancedPrisma(user)

  const userData = await db.user.findUnique({
    where: { id: user.id },
    include: {
      comments: {
        include: {
          article: {
            select: {
              slug: true,
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
      },
      articleReactions: {
        where: { userId: user.id },
        include: {
          article: {
            select: {
              id: true,
              slug: true,
              title: true,
              imageUrl: true,
              createdAt: true,
              user: { select: { username: true, avatarUrl: true } },
              views: true,
              tags: { select: { tag: { select: { name: true } } } },
              reactions: { select: { id: true } },
            },
          },
        },
      },
    },
  })

  if (!userData) throw createError({ statusCode: 404, message: 'Uživatel nenalezen' })

  return {
    likedArticles: userData.articleReactions.map((reaction) => ({
      id: reaction.article.id,
      slug: reaction.article.slug,
      title: reaction.article.title,
      imageUrl: reaction.article.imageUrl,
      createdAt: reaction.article.createdAt?.toISOString() || null,
      authorUsername: reaction.article.user?.username || 'Anonym',
      authorPfp: reaction.article.user?.avatarUrl || null,
      views: reaction.article.views,
      tags: reaction.article.tags.map((t) => t.tag.name),
      likesCount: reaction.article.reactions.length,
    })),
    comments: userData.comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      articleSlug: comment.article?.slug || '',
      articleTitle: comment.article?.title || '',
      authorUsername: comment.user?.username || 'Anonym',
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
  }
})

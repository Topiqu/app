export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const { id } = getRouterParams(event)
  if (user.id !== id && user.role !== 'superadmin')
    throw createError({ statusCode: 403, message: 'Nepovolený přístup' })
  const db = await getEnhancedPrisma(user)

  const userData = await db.user.findUnique({
    where: { id },
    include: {
      comments: {
        include: {
          reactions: { select: { type: true } },
          article: {
            select: {
              slug: true,
              title: true,
              user: { select: { username: true, avatarUrl: true } },
              views: true,
              tags: { select: { tag: { select: { name: true } } } },
            },
          },
        },
      },
      followers: {
        select: { followerId: true },
      },
      following: {
        select: { followedId: true },
      },
      articleReactions: {
        where: { userId: id },
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

  const likesCount = userData.comments.reduce(
    (sum, comment) => sum + comment.reactions.filter((r) => r.type === 'LIKE').length,
    0,
  )
  const dislikesCount = userData.comments.reduce(
    (sum, comment) => sum + comment.reactions.filter((r) => r.type === 'DISLIKE').length,
    0,
  )

  return {
    id: userData.id,
    username: userData.username,
    email: userData.email,
    bio: userData.bio,
    avatarUrl: userData.avatarUrl,
    createdAt: userData.createdAt.toISOString(),
    lastLogin: userData.lastLogin ? userData.lastLogin.toISOString() : null,
    allowNotifs: userData.allowNotifs,
    allowEmail: userData.allowEmail,
    role: userData.role,
    emailVerified: userData.emailVerified,
    clientSiteId: userData.clientSiteId,
    language: userData.language,
    commentsCount: userData.comments.length,
    likesCount,
    dislikesCount,
    followers: userData.followers.length,
    following: userData.following.length,
    theme: userData.theme,
    likedArticles: userData.articleReactions.map((reaction) => ({
      id: reaction.article.id,
      slug: reaction.article.slug,
      title: reaction.article.title,
      imageUrl: reaction.article.imageUrl,
      createdAt: reaction.article.createdAt?.toISOString() || null,
      authorUsername: reaction.article.user?.username || 'Anonym',
      authorPfp: reaction.article.user.avatarUrl,
      views: reaction.article.views,
      tags: reaction.article.tags.map((t) => t.tag.name),
      likesCount: reaction.article.reactions.length,
    })),
    comments: userData.comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      articleSlug: comment.article?.slug || '',
      articleTitle: comment.article?.title || '',
      authorUsername: comment.article?.user?.username || 'Anonym',
      authorPfp: comment.article.user.avatarUrl,
      views: comment.article?.views || 0,
      tags: comment.article?.tags.map((t) => t.tag.name) || [],
      createdAt: comment.createdAt.toISOString(),
      likesCount: comment.reactions.filter((r) => r.type === 'LIKE').length,
      dislikesCount: comment.reactions.filter((r) => r.type === 'DISLIKE').length,
    })),
  }
})

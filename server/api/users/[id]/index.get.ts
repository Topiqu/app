export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const { id } = getRouterParams(event)
  if (user.id !== id && user.role !== 'superadmin')
    throw createError({ statusCode: 403, message: 'Nepovolený přístup' })

  const userData = await prisma.user.findUnique({
    where: { id },
    include: {
      comments: {
        include: {
          reactions: { select: { type: true } },
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
              publishedAt: true,
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
    role: userData.role,
    emailVerified: userData.emailVerified,
    clientSiteId: userData.clientSiteId,
    commentsCount: userData.comments.length,
    likesCount,
    dislikesCount,
    followers: userData.followers.length,
    following: userData.following.length,
    theme: userData.theme,
    likedArticles: userData.articleReactions
      .filter((reaction) => reaction.userId === id)
      .map((reaction) => ({
        id: reaction.article.id,
        slug: reaction.article.slug,
        title: reaction.article.title,
        imageUrl: reaction.article.imageUrl,
        publishedAt: reaction.article.publishedAt?.toISOString() || null,
      })),
  }
})

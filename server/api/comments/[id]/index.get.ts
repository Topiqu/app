import type { CommentWithReplies } from '~~/types/comment'

export default defineEventHandler(async (event) => {
  const articleId = getRouterParam(event, 'id')
  if (!articleId) throw createError({ statusCode: 400, message: 'Chybí ID článku' })

  const user = (await getServerSession(event))?.user
  const query = getQuery(event)
  const sort = typeof query.sort === 'string' ? query.sort : 'createdAt:desc'
  const [sortField, sortOrder] = sort.split(':') as ['createdAt' | 'likes', 'asc' | 'desc']
  const { skip, take } = await getPagination(event)
  const max = 75
  const adjustedTake = Math.min(take, max - skip)
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { userId: true, clientSiteId: true },
  })
  if (!article) throw createError({ statusCode: 404, message: 'Článek nenalezen' })

  const allComments = await prisma.comment.findMany({
    where: { articleId },
    select: {
      id: true,
      content: true,
      createdAt: true,
      userId: true,
      parentId: true,
      deletedAt: true,
      articleId: true,
      article: { select: { clientSiteId: true, userId: true } },
      user: {
        include: {
          comments: {
            select: {
              id: true,
              userId: true,
              reactions: { select: { type: true } },
            },
          },
          followers: { select: { followerId: true } },
          following: { select: { followedId: true } },
          bans: {
            select: {
              reason: true,
              expiresAt: true,
              clientSiteId: true,
              deletedAt: true,
            },
            where: {
              deletedAt: null,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
          },
        },
      },
      reactions: { select: { type: true, userId: true } },
      emojiReactions: {
        select: { emojiId: true, emoji: { select: { imageUrl: true, shortcode: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const topLevelComments = allComments.filter((c) => c.parentId === null)
  const allReplies = allComments.filter((c) => c.parentId !== null)

  const totalCount = await prisma.comment.count({
    where: { articleId, parentId: null },
  })

  const buildCommentTree = (
    comment: any,
    allReplies: any[],
    currentDepth: number = 1,
    clientSiteId: string,
  ): CommentWithReplies => {
    const userData = comment.user
    const relevantBans = userData ? userData.bans.filter((ban: any) => ban.clientSiteId === clientSiteId) : []
    const isBanned = relevantBans.length > 0
    const banDetails = isBanned
      ? {
          reason: relevantBans[0]?.reason ?? undefined,
          expiresAt: relevantBans[0]?.expiresAt?.toISOString() ?? undefined,
        }
      : undefined

    const likesCount = userData
      ? userData.comments.reduce(
          (sum: number, comment: any) => sum + comment.reactions.filter((r: any) => r.type === 'LIKE').length,
          0,
        )
      : 0
    const dislikesCount = userData
      ? userData.comments.reduce(
          (sum: number, comment: any) => sum + comment.reactions.filter((r: any) => r.type === 'DISLIKE').length,
          0,
        )
      : 0
    const followersCount = userData ? userData.followers.length : 0
    const followingCount = userData ? userData.following.length : 0
    const userReaction = user ? (comment.reactions.find((r: any) => r.userId === user.id) ?? null) : null
    const isLikedByAuthor = comment.reactions.some((r: any) => r.userId === article.userId && r.type === 'LIKE')

    const emojiReactions = Object.entries(
      comment.emojiReactions.reduce(
        (acc: any, r: any) => {
          acc[r.emojiId] = {
            count: (acc[r.emojiId]?.count || 0) + 1,
            emoji: r.emoji,
          }
          return acc
        },
        {} as Record<string, { count: number; emoji: { imageUrl: string; shortcode: string } }>,
      ),
    ).map(([emojiId, data]: [string, any]) => ({
      emojiId,
      count: data.count,
      emoji: data.emoji,
    }))

    const directReplies = allReplies.filter((reply) => reply.parentId === comment.id)

    const processedReplies = directReplies.map((reply) =>
      buildCommentTree(reply, allReplies, currentDepth + 1, clientSiteId),
    )

    return {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      userId: comment.userId,
      parentId: comment.parentId,
      deletedAt: comment.deletedAt,
      articleId: comment.articleId,
      user: userData
        ? {
            username: userData.username,
            email: userData.email ?? undefined,
            avatarUrl: userData.avatarUrl ?? undefined,
            bio: userData.bio ?? undefined,
            createdAt: userData.createdAt.toISOString(),
            lastLogin: userData.lastLogin ? userData.lastLogin.toISOString() : undefined,
            commentsCount: userData.comments.length,
            likesCount,
            dislikesCount,
            followers: followersCount,
            following: followingCount,
            role: userData.role,
            isBanned,
            banDetails,
          }
        : null,
      article: { clientSiteId: article.clientSiteId, userId: article.userId },
      likes: comment.reactions.filter((r: any) => r.type === 'LIKE').length,
      dislikes: comment.reactions.filter((r: any) => r.type === 'DISLIKE').length,
      replies: processedReplies,
      userReaction: userReaction ? { type: userReaction.type } : null,
      emojiReactions,
      depth: currentDepth,
      isLikedByAuthor,
    }
  }

  const sortedTopLevel = topLevelComments.sort((a, b) => {
    if (sortField === 'likes') {
      const aLikes = a.reactions.filter((r) => r.type === 'LIKE').length
      const bLikes = b.reactions.filter((r) => r.type === 'LIKE').length
      return sortOrder === 'desc' ? bLikes - aLikes : aLikes - bLikes
    } else {
      return sortOrder === 'desc'
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    }
  })

  const paginatedTopLevel = sortedTopLevel.slice(skip, skip + adjustedTake)

  const processedComments = paginatedTopLevel.map((comment) =>
    buildCommentTree(comment, allReplies, 1, comment.article.clientSiteId),
  )

  return {
    comments: processedComments,
    hasMore: skip + paginatedTopLevel.length < totalCount,
  }
})

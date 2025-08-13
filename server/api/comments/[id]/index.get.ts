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

  const allComments = await prisma.comment.findMany({
    where: { articleId, parentId: null, deletedAt: null },
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
        },
      },
      reactions: { select: { type: true, userId: true } },
      emojiReactions: {
        select: { emojiId: true, emoji: { select: { imageUrl: true, shortcode: true } } },
      },
      replies: {
        where: { deletedAt: null },
        select: {
          id: true,
          content: true,
          createdAt: true,
          userId: true,
          parentId: true,
          deletedAt: true,
          articleId: true,
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
            },
          },
          reactions: { select: { type: true, userId: true } },
          emojiReactions: {
            select: { emojiId: true, emoji: { select: { imageUrl: true, shortcode: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: sortField === 'likes' ? { reactions: { _count: sortOrder } } : { createdAt: sortOrder },
    skip,
    take: adjustedTake,
  })

  const totalCount = await prisma.comment.count({
    where: { articleId, parentId: null, deletedAt: null },
  })

  const commentMap = new Map<string, CommentWithReplies>()

  for (const c of allComments) {
    const userData = c.user
    const articleData = c.article
    const likesCount = userData
      ? userData.comments.reduce((sum, comment) => sum + comment.reactions.filter((r) => r.type === 'LIKE').length, 0)
      : 0
    const dislikesCount = userData
      ? userData.comments.reduce(
          (sum, comment) => sum + comment.reactions.filter((r) => r.type === 'DISLIKE').length,
          0,
        )
      : 0
    const followersCount = userData ? userData.followers.length : 0
    const followingCount = userData ? userData.following.length : 0
    const userReaction = user ? (c.reactions.find((r) => r.userId === user.id) ?? null) : null

    const emojiReactions = Object.entries(
      c.emojiReactions.reduce(
        (acc, r) => {
          acc[r.emojiId] = {
            count: (acc[r.emojiId]?.count || 0) + 1,
            emoji: r.emoji,
          }
          return acc
        },
        {} as Record<string, { count: number; emoji: { imageUrl: string; shortcode: string } }>,
      ),
    ).map(([emojiId, { count, emoji }]) => ({
      emojiId,
      count,
      emoji,
    }))

    commentMap.set(c.id, {
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      userId: c.userId,
      parentId: c.parentId,
      deletedAt: c.deletedAt,
      articleId: c.articleId,
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
          }
        : null,
      article: { clientSiteId: articleData.clientSiteId, userId: articleData.userId },
      likes: c.reactions.filter((r) => r.type === 'LIKE').length,
      dislikes: c.reactions.filter((r) => r.type === 'DISLIKE').length,
      replies: c.replies.map((r) => {
        const rUserData = r.user
        const rLikesCount = rUserData
          ? rUserData.comments.reduce(
              (sum, comment) => sum + comment.reactions.filter((r) => r.type === 'LIKE').length,
              0,
            )
          : 0
        const rDislikesCount = rUserData
          ? rUserData.comments.reduce(
              (sum, comment) => sum + comment.reactions.filter((r) => r.type === 'DISLIKE').length,
              0,
            )
          : 0
        const rFollowersCount = rUserData ? rUserData.followers.length : 0
        const rFollowingCount = rUserData ? rUserData.following.length : 0
        const rUserReaction = user ? (r.reactions.find((r) => r.userId === user.id) ?? null) : null

        const rEmojiReactions = Object.entries(
          r.emojiReactions.reduce(
            (acc, r) => {
              acc[r.emojiId] = {
                count: (acc[r.emojiId]?.count || 0) + 1,
                emoji: r.emoji,
              }
              return acc
            },
            {} as Record<string, { count: number; emoji: { imageUrl: string; shortcode: string } }>,
          ),
        ).map(([emojiId, { count, emoji }]) => ({
          emojiId,
          count,
          emoji,
        }))

        return {
          id: r.id,
          content: r.content,
          createdAt: r.createdAt,
          userId: r.userId,
          parentId: r.parentId,
          deletedAt: r.deletedAt,
          articleId: r.articleId,
          user: rUserData
            ? {
                username: rUserData.username,
                email: rUserData.email ?? undefined,
                avatarUrl: rUserData.avatarUrl ?? undefined,
                bio: rUserData.bio ?? undefined,
                createdAt: rUserData.createdAt.toISOString(),
                lastLogin: rUserData.lastLogin ? rUserData.lastLogin.toISOString() : undefined,
                commentsCount: rUserData.comments.length,
                likesCount: rLikesCount,
                dislikesCount: rDislikesCount,
                followers: rFollowersCount,
                following: rFollowingCount,
                role: rUserData.role,
              }
            : null,
          article: { clientSiteId: articleData.clientSiteId, userId: articleData.userId },
          likes: r.reactions.filter((r) => r.type === 'LIKE').length,
          dislikes: r.reactions.filter((r) => r.type === 'DISLIKE').length,
          replies: [],
          userReaction: rUserReaction ? { type: rUserReaction.type } : null,
          emojiReactions: rEmojiReactions,
          depth: 2,
        }
      }),
      userReaction: userReaction ? { type: userReaction.type } : null,
      emojiReactions,
      depth: 1,
    })
  }

  return {
    comments: [...commentMap.values()],
    hasMore: skip + allComments.length < totalCount,
  }
})

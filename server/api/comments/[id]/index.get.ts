import type { CommentWithReplies } from '~~/types/comment'

export default defineEventHandler(async (event) => {
  const articleId = getRouterParam(event, 'id')
  if (!articleId) throw createError({ statusCode: 400, message: 'Chybí ID článku' })

  const user = (await getServerSession(event))?.user

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
          followers: {
            select: { followerId: true },
          },
          following: {
            select: { followedId: true },
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
          }
        : null,
      article: { clientSiteId: articleData.clientSiteId, userId: articleData.userId },
      likes: c.reactions.filter((r) => r.type === 'LIKE').length,
      dislikes: c.reactions.filter((r) => r.type === 'DISLIKE').length,
      replies: [],
      userReaction: userReaction ? { type: userReaction.type } : null,
      emojiReactions,
    })
  }

  const roots: CommentWithReplies[] = []

  for (const comment of commentMap.values()) {
    if (!comment.parentId) {
      comment.depth = 1
      roots.push(comment)
      continue
    }

    let depth = 1
    let parent = commentMap.get(comment.parentId)
    while (parent && parent.parentId) {
      depth++
      parent = commentMap.get(parent.parentId)
    }

    comment.depth = depth + 1

    if (depth < 12) {
      const directParent = commentMap.get(comment.parentId)
      if (directParent) directParent.replies.push(comment)
    } else if (parent) {
      parent.replies.push(comment)
    }
  }

  return roots
})

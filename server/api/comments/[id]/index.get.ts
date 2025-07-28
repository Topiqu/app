import type { CommentWithReplies } from '~~/types/comment'

export default defineEventHandler(async (event) => {
  const articleId = getRouterParam(event, 'id')
  if (!articleId) throw createError({ statusCode: 400, statusMessage: 'Chybí ID článku' })

  const user = (await getServerSession(event))?.user

  const allComments = await prisma.comment.findMany({
    where: {
      articleId,
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      userId: true,
      parentId: true,
      deletedAt: true,
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          avatarUrl: true,
          lastLogin: true,
          createdAt: true,
          bio: true,
          comments: {
            select: {
              id: true,
              reactions: {
                select: { type: true },
              },
            },
          },
        },
      },
      reactions: {
        select: { type: true, userId: true },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  const commentMap = new Map<string, CommentWithReplies>()

  for (const c of allComments) {
    const userData = c.user
    const likesCount = userData
      ? userData.comments.reduce((sum, comment) => sum + comment.reactions.filter((r) => r.type === 'LIKE').length, 0)
      : 0
    const dislikesCount = userData
      ? userData.comments.reduce(
          (sum, comment) => sum + comment.reactions.filter((r) => r.type === 'DISLIKE').length,
          0,
        )
      : 0

    commentMap.set(c.id, {
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      userId: c.userId,
      parentId: c.parentId,
      deletedAt: c.deletedAt,
      user: userData
        ? {
            id: userData.id,
            username: userData.username,
            email: userData.email,
            avatarUrl: userData.avatarUrl ?? undefined,
            bio: userData.bio ?? undefined,
            createdAt: userData.createdAt.toISOString(),
            lastLogin: userData.lastLogin ? userData.lastLogin.toISOString() : undefined,
            commentsCount: userData.comments.length,
            likesCount,
            dislikesCount,
          }
        : null,
      likes: c.reactions.filter((r) => r.type === 'LIKE').length,
      dislikes: c.reactions.filter((r) => r.type === 'DISLIKE').length,
      replies: [],
      userReaction: user
        ? c.reactions.find((r) => r.userId === user.id)
          ? { type: c.reactions.find((r) => r.userId === user.id)!.type }
          : null
        : null,
    })
  }

  const roots: CommentWithReplies[] = []

  for (const comment of commentMap.values()) {
    if (comment.parentId) {
      const parent = commentMap.get(comment.parentId)
      parent?.replies.push(comment)
    } else {
      roots.push(comment)
    }
  }

  return roots
})

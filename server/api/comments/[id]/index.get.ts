import type { CommentWithReplies } from '~/types/comment'

export default defineEventHandler(async (event) => {
  const articleId = getRouterParam(event, 'id')
  if (!articleId)
    throw createError({ statusCode: 400, statusMessage: 'Chybí ID článku' })

  const user = (await getServerSession(event))?.user

  const allComments = await prisma.comment.findMany({
    where: {
      articleId,
      deletedAt: null,
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      userId: true,
      parentId: true,
      user: {
        select: {
          id: true,
          username: true,
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
    commentMap.set(c.id, {
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      userId: c.userId,
      parentId: c.parentId,
      user: c.user,
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
      if (parent) parent.replies.push(comment)
    } else {
      roots.push(comment)
    }
  }

  return roots
})

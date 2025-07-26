export default defineEventHandler(async (event) => {
  type CommentWithReplies = {
    id: string
    content: string
    createdAt: Date
    userId: string
    parentId: string | null
    user: {
      id: string
      username: string
    }
    replies: CommentWithReplies[]
  }
  const articleId = getRouterParam(event, 'id')
  if (!articleId)
    throw createError({ statusCode: 400, statusMessage: 'Chybí ID článku' })

  const comments = await prisma.comment.findMany({
    where: {
      articleId,
      deletedAt: null,
      parentId: null,
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
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  const allReplies = await prisma.comment.findMany({
    where: {
      articleId,
      deletedAt: null,
      parentId: { not: null },
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
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  const commentMap = new Map<string, CommentWithReplies>(
    comments.map((c) => [c.id, { ...c, replies: [] }]),
  )

  const findParent = (commentId: string): string | null => {
    let current = allReplies.find((r) => r.id === commentId)
    while (current && current.parentId) {
      const parent =
        commentMap.get(current.parentId) ||
        allReplies.find((r) => r.id === current?.parentId)
      if (!parent || !parent.parentId) return current.parentId
      current = parent
    }
    return null
  }

  allReplies.forEach((reply) => {
    const topLevelParentId = findParent(reply.id)
    const parent = commentMap.get(topLevelParentId ?? '')
    if (parent) parent.replies.push({ ...reply, replies: [] })
  })

  return Array.from(commentMap.values())
})

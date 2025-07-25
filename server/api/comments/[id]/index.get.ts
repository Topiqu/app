export default defineEventHandler(async (event) => {
  const articleId = getRouterParam(event, 'id')
  if (!articleId)
    throw createError({ statusCode: 400, statusMessage: 'Chybí ID článku' })

  const comments = await prisma.comment.findMany({
    where: {
      articleId,
      deletedAt: null,
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      userId: true,
      user: {
        select: {
          id: true,
          username: true,
        },
      },
      replies: {
        select: {
          id: true,
          content: true,
          createdAt: true,
          user: {
            select: {
              username: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  return comments
})

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const notifications = await prisma.notification.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
    },
    select: {
      id: true,
      message: true,
      type: true,
      createdAt: true,
      articleId: true,
      isRead: true,
      article: {
        select: {
          title: true,
          slug: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  const count = await prisma.notification.count({
    where: {
      userId: user.id,
      deletedAt: null,
    },
  })

  const unreadCount = await prisma.notification.count({
    where: {
      userId: user.id,
      deletedAt: null,
      isRead: false,
    },
  })

  return {
    notifications,
    count,
    unreadCount,
  }
})

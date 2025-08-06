export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const db = await getEnhancedPrisma(user)

  const notifications = await db.notification.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
    },
    include: {
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

  const unreadCount = await db.notification.count({
    where: {
      userId: user.id,
      isRead: false,
      deletedAt: null,
    },
  })

  return {
    notifications,
    count: notifications.length,
    unreadCount,
  }
})

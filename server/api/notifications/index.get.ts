export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const db = await getEnhancedPrisma(user)
  const { skip, take } = await getPagination(event)
  const max = 75
  const adjustedTake = Math.min(take, max - skip)

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
    skip,
    take: adjustedTake,
  })

  const totalCount = await db.notification.count({
    where: {
      userId: user.id,
      deletedAt: null,
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
    unreadCount,
    hasMore: skip + notifications.length < Math.min(totalCount, max),
  }
})

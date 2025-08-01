export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const topLiked = await prisma.article.findFirst({
    where: {
      userId: user.id,
      status: 'published',
    },
    select: {
      id: true,
      title: true,
      _count: {
        select: { reactions: true },
      },
    },
    orderBy: {
      reactions: {
        _count: 'desc',
      },
    },
    take: 1,
  })

  return topLiked
    ? {
        id: topLiked.id,
        title: topLiked.title,
        likes: topLiked._count.reactions,
      }
    : null
})

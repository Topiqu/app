export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const topCommented = await prisma.article.findFirst({
    where: {
      userId: user.id,
      status: 'published',
    },
    select: {
      id: true,
      title: true,
      _count: {
        select: { comments: true },
      },
    },
    orderBy: {
      comments: {
        _count: 'desc',
      },
    },
    take: 1,
  })

  return topCommented
    ? {
        id: topCommented.id,
        title: topCommented.title,
        comments: topCommented._count.comments,
      }
    : null
})

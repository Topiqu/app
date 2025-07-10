export default defineEventHandler(async (event) => {
  const tagId = event.context.params!.id

  const articles = await prisma.article.findMany({
    where: {
      tags: {
        some: {
          tagId,
        },
      },
    },
    include: {
      tags: {
        include: {
          tag: true,
        },
      },
      user: {
        select: {
          username: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return articles
})

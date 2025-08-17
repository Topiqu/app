export default defineEventHandler(async () => {
  return prisma.article.findMany({
    where: { clientSite: { name: 'GameDev' }, status: 'published' },
    include: {
      user: { select: { username: true, id: true, avatarUrl: true } },
      tags: { include: { tag: true } },
      reactions: true,
      _count: {
        select: {
          comments: { where: { deletedAt: null } },
          reactions: true,
        },
      },
    },
    orderBy: { publishedAt: 'desc' },
  })
})

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, message: 'Neplatný požadavek' })

  const clientSite = await prisma.clientSite.findFirst({
    where: { name: slug },
  })
  if (!clientSite) throw createError({ statusCode: 404, message: 'Blog nenalezen' })

  return prisma.article.findMany({
    where: { clientSiteId: clientSite.id, status: 'published' },
    select: {
      id: true,
      slug: true,
      title: true,
      content: true,
      imageUrl: true,
      createdAt: true,
      readingTime: true,
      user: {
        select: { id: true, username: true, avatarUrl: true },
      },
      tags: {
        select: {
          tag: {
            select: { id: true, name: true, slug: true },
          },
        },
      },
      _count: {
        select: {
          comments: { where: { deletedAt: null } },
          reactions: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
})

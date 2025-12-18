export default defineEventHandler(async (event) => {
  const { skip, take } = await getPagination(event)
  const apiKey = getHeader(event, 'x-api-key')

  if (!apiKey) {
    throw createError({ statusCode: 401, message: 'Missing API Key' })
  }

  const clientSite = await prisma.clientSite.findFirst({
    where: { apiKey },
    select: { id: true },
  })

  if (!clientSite) {
    throw createError({ statusCode: 401, message: 'Invalid API Key' })
  }

  const [total, articles] = await prisma.$transaction([
    prisma.article.count({
      where: {
        clientSiteId: clientSite.id,
        status: 'published',
      },
    }),
    prisma.article.findMany({
      where: {
        clientSiteId: clientSite.id,
        status: 'published',
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        content: true,
        imageUrl: true,
        createdAt: true,
        tags: true,
        user: {
          select: {
            username: true,
            avatarUrl: true,
          },
        },
      },
    }),
  ])

  return {
    data: articles,
    meta: {
      total,
      page: skip / take + 1,
      limit: take,
    },
  }
})

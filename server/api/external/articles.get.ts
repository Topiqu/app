export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { skip, take } = await getPagination(event)
  const tagQuery = query.tag as string | undefined

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

  const tags = tagQuery
    ? tagQuery
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : []

  const whereCondition = {
    clientSiteId: clientSite.id,
    status: 'published' as const,
    ...(tags.length > 0 && {
      AND: tags.map((t) => ({
        tags: {
          some: {
            tag: {
              slug: t,
            },
          },
        },
      })),
    }),
  }

  const [total, articles] = await prisma.$transaction([
    prisma.article.count({
      where: whereCondition,
    }),
    prisma.article.findMany({
      where: whereCondition,
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
        tags: {
          select: {
            tag: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
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
      page: Math.floor(skip / take) + 1,
      limit: take,
    },
  }
})

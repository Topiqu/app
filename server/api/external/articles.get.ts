export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { skip, take } = await getPagination(event)
  const clientSite = await requireExternalClient(event)
  const tags = parseExternalTagFilter(query.tag)
  const whereCondition = externalArticleWhere(clientSite.id, tags)

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
        imageCredit: true,
        updatedAt: true,
        publishedAt: true,
        readingTime: true,
        totalWords: true,
        sources: true,
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
        articleSeries: { select: { id: true, name: true, slug: true } },
        translations: {
          where: { status: 'PUBLISHED' },
          select: { language: true, slug: true, title: true, excerpt: true, translatedAt: true },
          orderBy: { language: 'asc' },
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
      primaryLanguage: clientSite.language,
      appliedFilters: { tags },
    },
  }
})

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { skip, take } = await getPagination(event)
  const clientSite = await requireExternalClient(event)
  const tags = parseExternalTagFilter(query.tag)
  const where = externalArticleWhere(clientSite.id, tags)

  const [total, articles] = await prisma.$transaction([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: externalArticleSummaryV1Select,
    }),
  ])

  setResponseHeader(event, 'X-API-Version', '1')

  return {
    data: articles.map((article) => serializeExternalArticleV1(article, clientSite.language)),
    meta: {
      total,
      page: Math.floor(skip / take) + 1,
      limit: take,
      primaryLanguage: clientSite.language,
      appliedFilters: { tags },
    },
  }
})

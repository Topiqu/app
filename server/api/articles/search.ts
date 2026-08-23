import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const { user, membership } = await requireTenantScope(event, 'ARTICLE_WRITE')

  const { skip, take } = await getPagination(event)
  const filters = parseArticleListQuery(getQuery(event))

  const db = await getEnhancedPrisma(user)

  const clientSiteId = membership.clientSiteId

  const aiUserIds = await db.user
    .findMany({
      where: { clientSiteId, role: 'ai' },
      select: { id: true },
    })
    .then((users) => users.map((u) => u.id))

  const canEditOthers = hasTenantScope(membership, 'ARTICLE_WRITE_OTHERS')
  const authorFilter = canEditOthers ? {} : { userId: { in: [user.id, ...aiUserIds] } }
  const where = {
    clientSiteId,
    ...authorFilter,
    ...(filters.status ? { status: filters.status } : {}),
    ...(dateRangeWhere(filters.dateFrom, filters.dateTo)
      ? { createdAt: dateRangeWhere(filters.dateFrom, filters.dateTo) }
      : {}),
    ...(filters.query && {
      OR: [
        { title: { contains: filters.query, mode: 'insensitive' as const } },
        { excerpt: { contains: filters.query, mode: 'insensitive' as const } },
        { content: { contains: filters.query, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [articles, total] = await Promise.all([
    db.article.findMany({
      where,
      orderBy: { [filters.sort]: filters.order },
      skip,
      take,
      // Feeds the admin table's language column. Drafts are visible here on purpose — this is
      // the owning admin's own list, and "awaiting review" is the whole point of the column.
      include: { translations: { select: { language: true, status: true, slug: true } } },
    }),
    db.article.count({
      where,
    }),
  ])

  return { data: articles, total }
})

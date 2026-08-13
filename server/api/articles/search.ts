import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user?.id) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const { skip, take } = await getPagination(event)
  const filters = parseArticleListQuery(getQuery(event))

  const db = await getEnhancedPrisma(user)

  const clientSite = await db.clientSite.findFirst({
    where: { users: { some: { id: user.id } } },
    select: { id: true },
  })

  if (!clientSite?.id) {
    return { data: [], total: 0 }
  }

  const aiUserIds = await db.user
    .findMany({
      where: { clientSiteId: clientSite.id, role: 'ai' },
      select: { id: true },
    })
    .then((users) => users.map((u) => u.id))

  const where = {
    clientSiteId: clientSite.id,
    userId: { in: [user.id, ...aiUserIds] },
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
    }),
    db.article.count({
      where,
    }),
  ])

  return { data: articles, total }
})

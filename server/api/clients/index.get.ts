export default defineEventHandler(async (event) => {
  const { db } = await requireDb(event, { role: 'superadmin' })
  const { skip, take } = await getPagination(event)
  const filters = parseClientListQuery(getQuery(event))

  const where = {
    ...(filters.status === 'active'
      ? { deletedAt: null }
      : filters.status === 'deactivated'
        ? { deletedAt: { not: null } }
        : {}),
    ...(filters.plan ? { plan: filters.plan } : {}),
    ...(filters.name ? { name: { contains: filters.name, mode: 'insensitive' as const } } : {}),
    ...(filters.domain ? { domain: { contains: filters.domain, mode: 'insensitive' as const } } : {}),
    ...(dateRangeWhere(filters.dateFrom, filters.dateTo)
      ? { createdAt: dateRangeWhere(filters.dateFrom, filters.dateTo) }
      : {}),
    ...(filters.query && {
      OR: [
        { name: { contains: filters.query, mode: 'insensitive' as const } },
        { domain: { contains: filters.query, mode: 'insensitive' as const } },
        { audience: { contains: filters.query, mode: 'insensitive' as const } },
        { focus: { contains: filters.query, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [data, total] = await Promise.all([
    db.clientSite.findMany({
      include: {
        _count: { select: { users: true } },
      },
      where,
      orderBy: { [filters.sort]: filters.order },
      skip,
      take,
    }),
    db.clientSite.count({
      where,
    }),
  ])

  return {
    data: data.map(({ _count, ...client }) => ({ ...client, userCount: _count.users })),
    total,
  }
})

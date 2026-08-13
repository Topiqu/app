import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const { translate: t } = await useServerI18n(event)
  const { user, membership } = await requireTenantScope(event, 'ARTICLE_WRITE')

  const { skip, take } = await getPagination(event)
  const query = getQuery(event).query as string | undefined

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
    ...(query && {
      OR: [
        { title: { contains: query, mode: 'insensitive' as const } },
        { excerpt: { contains: query, mode: 'insensitive' as const } },
        { content: { contains: query, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [articles, total] = await Promise.all([
    db.article.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      // Feeds the admin table's language column. Drafts are visible here on purpose — this is
      // the owning admin's own list, and "awaiting review" is the whole point of the column.
      include: { translations: { select: { language: true, status: true, slug: true } } },
    }),
    db.article.count({ where }),
  ])

  return { data: articles, total }
})

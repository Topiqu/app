import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = (await getServerSession(event))?.user
  const { skip, take } = await getPagination(event)
  const query = getQuery(event).query as string | undefined

  if (!user?.id) throw createError({ statusCode: 401, message: 'Unauthorized' })

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

  const [articles, total] = await Promise.all([
    db.article.findMany({
      where: {
        clientSiteId: clientSite.id,
        userId: { in: [user.id, ...aiUserIds] },
        ...(query && {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { excerpt: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    db.article.count({
      where: {
        clientSiteId: clientSite.id,
        userId: { in: [user.id, ...aiUserIds] },
        ...(query && {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { excerpt: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
          ],
        }),
      },
    }),
  ])

  return { data: articles, total }
})

import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = (await getServerSession(event))?.user
  const { skip, take } = await getPagination(event)
  const query = getQuery(event).query as string | undefined

  const db = await getEnhancedPrisma(user)

  const [articles, total] = await Promise.all([
    db.article.findMany({
      where: {
        ...(user && { userId: user.id }),
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
        ...(user && { userId: user.id }),
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

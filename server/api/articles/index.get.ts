import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const session = await getServerSession(event)
  const { skip, take } = await getPagination(event)

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where: session ? { userId: session.user.id } : {},
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.article.count({
      where: session ? { userId: session.user.id } : {},
    }),
  ])

  return { data: articles, total }
})

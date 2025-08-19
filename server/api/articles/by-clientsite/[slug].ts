export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, message: 'Neplatný požadavek' })
  const { take, skip } = await getPagination(event)
  const query = getQuery(event)
  const tag = query.tag as string | undefined

  const db = await getEnhancedPrisma(user)
  const clientSite = await db.clientSite.findUnique({
    where: { name: slug },
    select: { id: true },
  })

  if (!clientSite) throw createError({ statusCode: 404, message: 'Blog nenalezen' })

  const articles = await db.article.findMany({
    where: {
      clientSiteId: clientSite.id,
      ...(tag && {
        tags: {
          some: {
            tag: {
              name: {
                equals: tag,
                mode: 'insensitive',
              },
            },
          },
        },
      }),
    },
    take,
    skip,
    include: {
      tags: { include: { tag: true } },
      user: { select: { id: true, username: true, email: true, role: true, avatarUrl: true } },
      _count: { select: { comments: true, reactions: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return articles
})

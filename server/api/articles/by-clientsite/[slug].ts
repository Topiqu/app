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

  const rows = await db.article.findMany({
    where: {
      clientSiteId: clientSite.id,
      ...(tag && {
        tags: { some: { tag: { name: { equals: tag, mode: 'insensitive' } } } },
      }),
    },
    take: take + 1,
    skip,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: {
      tags: { include: { tag: true } },
      user: { select: { id: true, username: true, email: true, role: true, avatarUrl: true } },
      _count: { select: { comments: true, reactions: true } },
    },
  })

  const allTags = await db.article
    .findMany({
      where: {
        clientSiteId: clientSite.id,
        status: 'published',
      },
      include: {
        tags: { include: { tag: true } },
      },
    })
    .then((articles) => [
      ...new Map(
        articles.flatMap((a) => a.tags).map((t) => [t.tag.id, { id: t.tag.id, name: t.tag.name, slug: t.tag.slug }]),
      ).values(),
    ])

  const hasMore = rows.length > take
  const items = hasMore ? rows.slice(0, take) : rows
  return { items, hasMore, tags: allTags }
})

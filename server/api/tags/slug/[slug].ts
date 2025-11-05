export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const tagName = decodeURIComponent(getRouterParam(event, 'slug')!.trim())
  if (!tagName) throw createError({ statusCode: 400, message: 'Neplatný požadavek' })

  const { skip, take } = await getPagination(event)
  const query = getQuery(event)
  const { search = '', sort = 'createdAt:desc', site } = query as { search?: string; sort?: string; site: string }
  if (!site) throw createError({ statusCode: 400, message: 'Chybí název blogu' })

  const db = await getEnhancedPrisma(user)

  const clientSite = await db.clientSite.findUnique({
    where: { name: site },
    select: { id: true },
  })
  if (!clientSite) throw createError({ statusCode: 404, message: 'Blog nenalezen' })

  const [field, order] = (sort as string).split(':') as ['createdAt' | 'title', 'asc' | 'desc']

  const tag = await db.tag.findFirst({
    where: {
      slug: tagName,
      clientSiteId: clientSite.id,
    },
    include: {
      articles: {
        where: search
          ? {
              article: {
                title: { contains: search, mode: 'insensitive' },
              },
            }
          : undefined,
        take: take + 1,
        skip,
        orderBy: { article: { [field]: order } },
        include: {
          article: {
            include: {
              tags: { include: { tag: true } },
              user: { omit: { password: true } },
              _count: { select: { reactions: true } },
            },
          },
        },
      },
    },
  })

  if (!tag) throw createError({ statusCode: 404, message: 'Tag nenalezen' })

  const hasMore = tag.articles.length > take
  const items = hasMore ? tag.articles.slice(0, take) : tag.articles

  return {
    ...tag,
    articles: items.map((a) => ({
      ...a,
      article: {
        ...a.article,
        likes: a.article._count.reactions,
      },
    })),
    hasMore,
  }
})

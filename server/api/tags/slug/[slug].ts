import { hasArticleAdminAccess, publicArticleWhere } from '../../../utils/articleViewerAccess'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  const user = await getSessionUser(event)

  const tagName = getRouterParam(event, 'slug', { decode: true })?.trim() ?? ''
  if (!tagName) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const { skip, take } = await getPagination(event)
  const query = getQuery(event)
  const { search = '', sort = 'createdAt:desc', site } = query as { search?: string; sort?: string; site: string }

  if (typeof site !== 'string' || !site || typeof sort !== 'string')
    throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const db = await getEnhancedPrisma(user)

  const clientSite = await db.clientSite.findUnique({
    where: { name: site, deletedAt: null },
    select: { id: true },
  })
  if (!clientSite) throw createError({ statusCode: 404, message: t('common.errors.blogNotFound')! })

  const [field, order] = (sort as string).split(':') as ['createdAt' | 'title', 'asc' | 'desc']
  if (
    !['createdAt', 'title'].includes(field) ||
    !['asc', 'desc'].includes(order) ||
    typeof search !== 'string' ||
    search.length > 300
  )
    throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const findTag = (identity: { slug: string } | { name: string }) =>
    db.tag.findFirst({
      where: {
        ...identity,
        clientSiteId: clientSite.id,
      },
    })

  const tag = (await findTag({ slug: tagName })) ?? (await findTag({ name: tagName }))

  if (!tag) throw createError({ statusCode: 404, message: t('common.errors.tagNotFound') ?? 'Tag nenalezen' })

  // ArticleTag itself is public, but its article may be hidden by policy. Query articles as the
  // root so ZenStack filters invisible drafts before pagination instead of returning null joins.
  const where = {
    ...(hasArticleAdminAccess(user, clientSite.id)
      ? { deletedAt: null, clientSite: { deletedAt: null } }
      : publicArticleWhere()),
    clientSiteId: clientSite.id,
    tags: { some: { tagId: tag.id } },
    ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}),
  }
  const [articles, total] = await Promise.all([
    db.article.findMany({
      where,
      take: take + 1,
      skip,
      orderBy: { [field]: order },
      select: {
        id: true,
        slug: true,
        language: true,
        title: true,
        excerpt: true,
        imageUrl: true,
        status: true,
        createdAt: true,
        publishedAt: true,
        readingTime: true,
        views: true,
        tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
        user: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { reactions: true, comments: true, shares: true } },
      },
    }),
    db.article.count({ where }),
  ])
  const hasMore = articles.length > take
  const items = hasMore ? articles.slice(0, take) : articles

  return {
    total,
    ...tag,
    articles: items.map((a) => ({
      ...a,
      likes: a._count.reactions,
      tags: a.tags.map((t) => t.tag),
    })),
    hasMore,
  }
})

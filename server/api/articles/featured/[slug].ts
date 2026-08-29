export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  const name = decodeURIComponent(getRouterParam(event, 'slug')!).trim()
  if (!name) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const locale = getQuery(event).locale as string | undefined

  const db = await getEnhancedPrisma(user)
  const clientSite = await db.clientSite.findUnique({
    where: { name },
    select: { id: true, language: true },
  })

  if (!clientSite) throw createError({ statusCode: 404, message: t('common.errors.blogNotFound')! })

  const buildFeatured = async () => {
    const monthAgo = new Date()
    monthAgo.setDate(monthAgo.getDate() - 360)

    const publicWhere = {
      clientSiteId: clientSite.id,
      status: 'published' as const,
      deletedAt: null,
      OR: [{ releaseAt: null }, { releaseAt: { lte: new Date() } }],
    }
    const totalArticles = await db.article.count({ where: publicWhere })
    const articles = await db.article.findMany({
      where: {
        ...publicWhere,
        ...(totalArticles < 150 ? {} : { createdAt: { gte: monthAgo } }),
      },
      include: {
        tags: { include: { tag: true } },
        user: { select: { id: true, username: true, role: true, avatarUrl: true } },
        // Scoped to the caller, and empty on the cached branch below, which is anonymous-only.
        reactions: {
          where: user?.id ? { userId: user.id } : { id: '' },
          select: { id: true },
          take: 1,
        },
        _count: { select: { comments: true, reactions: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    const sortedArticles = articles.sort((a, b) => {
      const aScore = (a._count?.reactions ?? 0) + (a._count?.comments ?? 0)
      const bScore = (b._count?.reactions ?? 0) + (b._count?.comments ?? 0)
      return bScore - aScore || b.createdAt.getTime() - a.createdAt.getTime()
    })
    const localized = await localizeArticles(db, sortedArticles.slice(0, 4), {
      clientSiteId: clientSite.id,
      locale,
      primaryLanguage: clientSite.language,
    })
    const cards = localized.map(({ reactions, ...article }) => ({
      ...article,
      likedByUser: reactions.length > 0,
    }))
    const [featured, ...recommended] = cards
    return { featured, recommended, totalArticles }
  }

  // Same rule as the feed: `db` is role-scoped by ZenStack, so only the
  // anonymous view is shareable.
  if (user) return buildFeatured()

  // Shares the feed's generation namespace on purpose — this list is derived
  // from the same articles, so invalidateFeed() already covers it.
  const gen = await feedGen(clientSite.id)
  const key = `featured:v${gen}:${clientSite.id}:loc=${locale ?? '_def'}`
  return cached(key, 600, buildFeatured)
})

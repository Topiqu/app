import { articleExcerpt } from '~~/shared/utils/articleBlocks'
import { articleCardSelect } from '~~/server/utils/articleCard'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await getSessionUser(event)
  const name = getRouterParam(event, 'slug', { decode: true })?.trim()
  if (!name) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const locale = getQuery(event).locale as string | undefined

  const db = await getEnhancedPrisma(user)
  const clientSite = await db.clientSite.findUnique({
    where: { name, deletedAt: null },
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
      select: articleCardSelect(user?.id),
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
    const cards = localized.map(({ reactions, content, ...article }) => ({
      ...article,
      // Cards only need the perex; the body stays out of the SSR payload and the Redis entry.
      excerpt: articleExcerpt(article.excerpt, content),
      likedByUser: reactions.length > 0,
    }))
    const [featured, ...recommended] = cards
    const topRows = await db.article.findMany({
      where: {
        ...publicWhere,
        id: { notIn: cards.map((article) => article.id) },
      },
      select: articleCardSelect(user?.id),
      orderBy: [{ views: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: 3,
    })
    const topArticles = await localizeArticles(db, topRows, {
      clientSiteId: clientSite.id,
      locale,
      primaryLanguage: clientSite.language,
    }).then((articles) =>
      articles.map(({ reactions, content, ...article }) => ({
        ...article,
        excerpt: articleExcerpt(article.excerpt, content),
        likedByUser: reactions.length > 0,
      })),
    )

    return { featured, recommended, topArticles, totalArticles }
  }

  // Same rule as the feed: `db` is role-scoped by ZenStack, so only the
  // anonymous view is shareable.
  if (user) return buildFeatured()

  // Shares the feed's generation namespace on purpose — this list is derived
  // from the same articles, so invalidateFeed() already covers it.
  const gen = await feedGen(clientSite.id)
  const key = `featured:3:v${gen}:${clientSite.id}:loc=${locale ?? '_def'}`
  return cached(key, 600, buildFeatured)
})

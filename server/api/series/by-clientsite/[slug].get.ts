import { SERIES_MIN_PARTS, seriesProgress } from '~~/shared/utils/seriesProgress'

const LIMIT = 3

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const name = decodeURIComponent(getRouterParam(event, 'slug') ?? '').trim()
  if (!name) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const locale = getQuery(event).locale as string | undefined
  // Anonymous scope: the list below is shared through the cache, whoever builds it.
  const db = await getEnhancedPrisma()
  const clientSite = await db.clientSite.findUnique({ where: { name }, select: { id: true, language: true } })
  if (!clientSite) throw createError({ statusCode: 404, message: t('common.errors.blogNotFound')! })

  const buildSeries = async () => {
    const publicWhere = {
      clientSiteId: clientSite.id,
      status: 'published' as const,
      deletedAt: null,
      OR: [{ releaseAt: null }, { releaseAt: { lte: new Date() } }],
    }
    const rows = await db.articleSeries.findMany({
      where: { clientSiteId: clientSite.id, articles: { some: publicWhere } },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        articles: {
          where: publicWhere,
          orderBy: [{ seriesOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            slug: true,
            title: true,
            excerpt: true,
            language: true,
            imageUrl: true,
            publishedAt: true,
            createdAt: true,
          },
        },
      },
    })

    const shelf = rows
      .filter((series) => series.articles.length >= SERIES_MIN_PARTS)
      .map((series) => ({
        ...series,
        updatedAt: new Date(
          Math.max(...series.articles.map((part) => +(part.publishedAt ?? part.createdAt))),
        ).toISOString(),
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, LIMIT)

    const localized = new Map(
      (
        await localizeArticles(
          db,
          shelf.flatMap((series) => series.articles),
          { clientSiteId: clientSite.id, locale, primaryLanguage: clientSite.language },
        )
      ).map((part) => [part.id, part]),
    )

    return shelf.map((series) => ({
      id: series.id,
      name: series.name,
      description: series.description,
      imageUrl: series.imageUrl ?? series.articles.find((part) => part.imageUrl)?.imageUrl ?? null,
      updatedAt: series.updatedAt,
      parts: series.articles.map((part) => {
        const { id, slug, title, language } = localized.get(part.id) ?? part
        return { id, slug, title, language }
      }),
    }))
  }

  const gen = await feedGen(clientSite.id)
  const shelf = await cached(`series:v${gen}:${clientSite.id}:loc=${locale ?? '_def'}`, 600, buildSeries)

  const user = (await getServerSession(event))?.user
  // Same identity `view.post.ts` writes: the user id when signed in, the anon cookie otherwise.
  const viewer = user?.id ?? readAnonSession(event)
  const partIds = shelf.flatMap((series) => series.parts.map((part) => part.id))
  // System-scoped: ArticleView is admin-readable only; the session id is server-issued and only
  // article ids leave this query.
  const readIds = new Set(
    viewer && partIds.length
      ? (
          await prisma.articleView.findMany({
            where: { sessionId: viewer, articleId: { in: partIds } },
            select: { articleId: true },
            distinct: ['articleId'],
          })
        ).map((view) => view.articleId)
      : [],
  )

  return shelf.map(({ parts, ...series }) => ({
    ...series,
    total: parts.length,
    first: parts[0]!,
    ...seriesProgress(parts, readIds),
  }))
})

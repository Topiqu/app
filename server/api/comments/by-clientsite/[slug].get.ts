const LIMIT = 4
const SNIPPET = 240

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const name = decodeURIComponent(getRouterParam(event, 'slug') ?? '').trim()
  if (!name) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const locale = getQuery(event).locale as string | undefined
  // Anonymous scope: nothing here is viewer-specific, so every reader shares one cached answer.
  const db = await getEnhancedPrisma()
  const clientSite = await db.clientSite.findUnique({
    where: { name },
    select: { id: true, language: true, commentsEnabled: true },
  })
  if (!clientSite) throw createError({ statusCode: 404, message: t('common.errors.blogNotFound')! })
  if (!clientSite.commentsEnabled) return []

  const buildDiscussions = async () => {
    const now = new Date()
    const comments = await db.comment.findMany({
      where: {
        deletedAt: null,
        article: {
          clientSiteId: clientSite.id,
          status: 'published',
          deletedAt: null,
          OR: [{ releaseAt: null }, { releaseAt: { lte: now } }],
        },
        user: {
          bans: {
            none: {
              clientSiteId: clientSite.id,
              deletedAt: null,
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      // Over-fetch so one busy thread cannot fill every row.
      take: LIMIT * 8,
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: { select: { username: true, avatarUrl: true } },
        article: {
          select: {
            id: true,
            slug: true,
            title: true,
            excerpt: true,
            language: true,
            _count: { select: { comments: { where: { deletedAt: null } } } },
          },
        },
      },
    })

    const seen = new Set<string>()
    const latest = comments.filter(({ article }) => !seen.has(article.id) && seen.add(article.id)).slice(0, LIMIT)
    const localized = new Map(
      (
        await localizeArticles(
          db,
          latest.map(({ article }) => article),
          { clientSiteId: clientSite.id, locale, primaryLanguage: clientSite.language },
        )
      ).map((article) => [article.id, article]),
    )

    return latest.map(({ article, content, ...comment }) => {
      const { slug, title, language } = localized.get(article.id) ?? article
      return {
        ...comment,
        content: content.length > SNIPPET ? `${content.slice(0, SNIPPET - 1).trimEnd()}…` : content,
        article: { slug, title, language, comments: article._count.comments },
      }
    })
  }

  // No generation bump on comment writes: a minute of staleness keeps every homepage hit off the
  // comments table, and a moderated comment drops out on the next rebuild.
  return cached(`discussions:${clientSite.id}:loc=${locale ?? '_def'}`, 60, buildDiscussions)
})

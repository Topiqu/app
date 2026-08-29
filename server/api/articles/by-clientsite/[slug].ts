export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  const slug = decodeURIComponent(getRouterParam(event, 'slug')!.trim())

  if (!slug) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const { take, skip } = await getPagination(event)
  const query = getQuery(event)
  const tag = query.tag as string | undefined
  const search = query.query as string | undefined
  const locale = query.locale as string | undefined

  const db = await getEnhancedPrisma(user)
  const clientSite = await db.clientSite.findUnique({
    where: { name: slug },
    select: { id: true, language: true },
  })

  if (!clientSite) throw createError({ statusCode: 404, message: t('common.errors.blogNotFound')! })

  const buildFeed = async () => {
    const rows = await db.article.findMany({
      where: {
        clientSiteId: clientSite.id,
        status: 'published',
        deletedAt: null,
        OR: [{ releaseAt: null }, { releaseAt: { lte: new Date() } }],
        ...(tag && {
          tags: { some: { tag: { name: { equals: tag, mode: 'insensitive' } } } },
        }),
        ...(search && {
          AND: {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { excerpt: { contains: search, mode: 'insensitive' } },
              { content: { contains: search, mode: 'insensitive' } },
            ],
          },
        }),
      },
      take: take + 1,
      skip,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        tags: { include: { tag: true } },
        // No email: this is an anonymous-readable payload and it gets cached.
        user: { select: { id: true, username: true, role: true, avatarUrl: true } },
        // Scoped to the caller so the payload answers one bool instead of shipping every liker's
        // id. Safe to cache: the cached branch below is anonymous-only, where this is always empty.
        reactions: {
          where: user?.id ? { userId: user.id } : { id: '' },
          select: { id: true },
          take: 1,
        },
        _count: { select: { comments: true, reactions: true } },
      },
    })

    const allTags = await db.article
      .findMany({
        where: {
          clientSiteId: clientSite.id,
          status: 'published',
          deletedAt: null,
          OR: [{ releaseAt: null }, { releaseAt: { lte: new Date() } }],
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

    const latestPollArticle = await db.article.findFirst({
      where: {
        clientSiteId: clientSite.id,
        status: 'published',
        deletedAt: null,
        OR: [{ releaseAt: null }, { releaseAt: { lte: new Date() } }],
        content: { contains: 'data-type="poll"' },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, content: true },
    })

    const firstPoll = latestPollArticle
      ? articleBlocks(latestPollArticle.content).blocks.find((block) => block.type === 'poll')
      : undefined
    const latestPoll = firstPoll ? { ...firstPoll, articleId: latestPollArticle!.id } : null

    const hasMore = rows.length > take
    const localized = await localizeArticles(db, hasMore ? rows.slice(0, take) : rows, {
      clientSiteId: clientSite.id,
      locale,
      primaryLanguage: clientSite.language,
    })
    const items = localized.map(({ reactions, ...article }) => ({
      ...article,
      likedByUser: reactions.length > 0,
    }))

    return { items, hasMore, tags: allTags, latestPoll: latestPoll ?? '' }
  }

  if (user || search) return buildFeed()

  const gen = await feedGen(clientSite.id)
  // `locale` is part of the key — the payload is localized, so two locales must not share it.
  const key = `feed:v${gen}:${clientSite.id}:tag=${tag ?? '_all'}:skip=${skip}:take=${take}:loc=${locale ?? '_def'}`
  // 10 min is only safe because every article mutation calls invalidateFeed().
  return cached(key, 600, buildFeed)
})

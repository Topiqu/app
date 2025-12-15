function unescapeHtml(safe: string | undefined): string {
  if (!safe) return ''
  return safe
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
}

function extractPollData(content: string, articleId: string) {
  const pollMatch = content.match(/<div[^>]*data-type="poll"[^>]*>/)
  if (!pollMatch) return null

  const tag = pollMatch[0]

  const idMatch = tag.match(/data-id="([^"]*)"/)
  const questionMatch = tag.match(/data-question="([^"]*)"/)
  const optionsMatch = tag.match(/data-options="([^"]*)"/)

  if (!questionMatch || !optionsMatch) return null

  try {
    const rawOptions = unescapeHtml(optionsMatch[1])
    const options = JSON.parse(rawOptions)

    return {
      type: 'poll',
      pollId: idMatch ? idMatch[1] : crypto.randomUUID(),
      question: unescapeHtml(questionMatch[1]),
      options: Array.isArray(options) ? options : [],
      articleId: articleId,
    }
  } catch (e) {
    console.error('Failed to parse poll data', e)
    return null
  }
}

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  const slug = decodeURIComponent(getRouterParam(event, 'slug')!.trim())

  if (!slug) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const { take, skip } = await getPagination(event)
  const query = getQuery(event)
  const tag = query.tag as string | undefined
  const search = query.query as string | undefined

  const db = await getEnhancedPrisma(user)
  const clientSite = await db.clientSite.findUnique({
    where: { name: slug },
    select: { id: true },
  })

  if (!clientSite) throw createError({ statusCode: 404, message: t('common.errors.blogNotFound')! })

  const rows = await db.article.findMany({
    where: {
      clientSiteId: clientSite.id,
      ...(tag && {
        tags: { some: { tag: { name: { equals: tag, mode: 'insensitive' } } } },
      }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { excerpt: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
        ],
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

  const latestPollArticle = await db.article.findFirst({
    where: {
      clientSiteId: clientSite.id,
      status: 'published',
      content: { contains: 'data-type="poll"' },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, content: true },
  })

  let latestPoll = null
  if (latestPollArticle) {
    latestPoll = extractPollData(latestPollArticle.content, latestPollArticle.id)
  }

  const hasMore = rows.length > take
  const items = hasMore ? rows.slice(0, take) : rows

  return { items, hasMore, tags: allTags, latestPoll: latestPoll ?? '' }
})

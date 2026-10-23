import type { Language } from '~~/generated/zenstack/models'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await getSessionUser(event)
  const sessionId = user?.id ? null : readAnonSession(event)

  const slug = getRouterParam(event, 'id')
  if (!slug) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const { take } = await getPagination(event)
  const { clientSiteId, locale } = getQuery<{ clientSiteId?: string; locale?: Language }>(event)
  if (!clientSiteId) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const clientSite = await prisma.clientSite.findUnique({
    where: { id: clientSiteId, deletedAt: null },
    select: { language: true, deletedAt: true },
  })
  if (!clientSite) throw createError({ statusCode: 404, message: t('common.errors.blogNotFound')! })

  const primaryLanguage = clientSite.language
  const isAdmin = hasArticleAdminAccess(user, clientSiteId)
  const now = new Date()

  const current = await resolveArticleBySlug<{
    id: string
    clientSiteId: string
    language: Language
    status: string
    deletedAt: Date | null
    releaseAt: Date | null
    tags: { tagId: string }[]
  }>(
    prisma,
    { slug, clientSiteId, locale, isAdmin },
    {
      id: true,
      clientSiteId: true,
      language: true,
      status: true,
      deletedAt: true,
      releaseAt: true,
      tags: { select: { tagId: true } },
    },
  )

  if (!current || !canReadArticle(user, { ...current, clientSite }, now))
    throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

  const tagIds = current.tags.map((tag) => tag.tagId)

  const candidates = await prisma.article.findMany({
    where: {
      // Tag.clientSiteId is nullable, so a global tag matches across tenants without this.
      clientSiteId,
      deletedAt: null,
      id: { not: current.id },
      ...(isAdmin
        ? {}
        : {
            status: 'published',
            OR: [{ releaseAt: null }, { releaseAt: { lte: now } }],
          }),
    },
    select: {
      ...articleCardSelect(user?.id),
      reactions: {
        where: user?.id ? { userId: user.id } : sessionId ? { sessionId, userId: null } : { id: '' },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: [{ releaseAt: 'desc' }, { createdAt: 'desc' }],
    take: take * 10,
  })

  const articles = candidates
    .map((article) => ({
      ...article,
      matchCount: article.tags.filter((tag) => tagIds.includes(tag.tagId)).length,
    }))
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, take)

  const localized = await localizeArticles(prisma, articles, { clientSiteId, locale, primaryLanguage })

  return localized.map(({ reactions, content: _content, ...article }) => ({
    ...article,
    likedByUser: reactions.length > 0,
  }))
})

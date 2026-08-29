import type { Language } from '@prisma/client'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  const sessionId = user?.id ? null : readAnonSession(event)

  const slug = getRouterParam(event, 'id')
  if (!slug) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const { take } = await getPagination(event)
  const { clientSiteId, locale } = getQuery<{ clientSiteId?: string; locale?: Language }>(event)
  if (!clientSiteId) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const clientSite = await prisma.clientSite.findUnique({
    where: { id: clientSiteId },
    select: { language: true },
  })
  if (!clientSite) throw createError({ statusCode: 404, message: t('common.errors.blogNotFound')! })

  const primaryLanguage = clientSite.language
  const isAdmin = user?.role === 'admin'

  const current = await resolveArticleBySlug<{ id: string; tags: { tagId: string }[] }>(
    prisma,
    { slug, clientSiteId, locale, primaryLanguage, isAdmin },
    { id: true, tags: { select: { tagId: true } } },
  )

  if (!current) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

  const tagIds = current.tags.map((tag) => tag.tagId)

  const candidates = await prisma.article.findMany({
    where: {
      // Tag.clientSiteId is nullable, so a global tag matches across tenants without this.
      clientSiteId,
      id: { not: current.id },
      ...(isAdmin ? {} : { status: 'published' }),
    },
    include: {
      tags: { include: { tag: true } },
      user: { select: { id: true, username: true, email: true, role: true, avatarUrl: true } },
      reactions: {
        where: user?.id ? { userId: user.id } : sessionId ? { sessionId, userId: null } : { id: '' },
        select: { id: true },
        take: 1,
      },
      _count: { select: { comments: true, reactions: true } },
    },
    omit: { content: true },
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

  return localized.map(({ reactions, ...article }) => ({ ...article, likedByUser: reactions.length > 0 }))
})

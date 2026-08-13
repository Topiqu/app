export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  const slug = getRouterParam(event, 'id')
  if (!slug) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const { take } = await getPagination(event)
  const { clientSiteId } = getQuery<{ clientSiteId: string }>(event)
  const { tags } = await prisma.article.findUniqueOrThrow({
    where: { slug_clientSiteId: { slug, clientSiteId } },
    select: { tags: { select: { tagId: true } } },
  })

  const tagIds = tags.map((tag) => tag.tagId)
  if (tagIds.length === 0) return []

  const candidates = await prisma.article.findMany({
    where: {
      clientSiteId,
      slug: { not: slug },
      status: 'published',
      deletedAt: null,
      OR: [{ releaseAt: null }, { releaseAt: { lte: new Date() } }],
      tags: { some: { tagId: { in: tagIds } } },
    },
    include: {
      tags: { include: { tag: true } },
      user: { select: { id: true, username: true, email: true, role: true, avatarUrl: true } },
      _count: { select: { comments: true, reactions: true } },
    },
    omit: { content: true },
    take: take * 10,
  })

  const articles = candidates
    .map((article) => ({
      ...article,
      matchCount: article.tags.filter((tag) => tagIds.includes(tag.tagId)).length,
    }))
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, take)

  return articles
})

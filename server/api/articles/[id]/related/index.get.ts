export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const slug = getRouterParam(event, 'id')
  if (!slug) throw createError({ statusCode: 400, message: 'Slug je povinný' })

  const { take } = await getPagination(event)

  const { tags } = await prisma.article.findUniqueOrThrow({
    where: { slug },
    select: { tags: { select: { tagId: true } } },
  })

  const tagIds = tags.map((tag) => tag.tagId)
  if (tagIds.length === 0) return []

  const candidates = await prisma.article.findMany({
    where: {
      slug: { not: slug },
      tags: { some: { tagId: { in: tagIds } } },
      ...(user?.role === 'admin' ? {} : { status: 'published' }),
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

  return articles
})

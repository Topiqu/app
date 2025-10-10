export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user

  const slug = getRouterParam(event, 'id')
  if (!slug) throw createError({ statusCode: 400, message: 'Slug je povinný' })

  const { take, skip } = await getPagination(event)

  const { tags } = await prisma.article.findUniqueOrThrow({
    where: { slug },
    select: { tags: { select: { tagId: true } } },
  })
  if (tags.length === 0) return []

  const articles = await prisma.article.findMany({
    include: {
      tags: { include: { tag: true } },
      user: { select: { id: true, username: true, email: true, role: true, avatarUrl: true } },
      _count: { select: { comments: true, reactions: true } },
    },
    omit: { content: true },
    where: {
      slug: { not: slug },
      tags: { some: { tagId: { in: tags.map((t) => t.tagId) } } },
      ...(user?.role === 'admin' ? {} : { status: 'published' }),
    },
    take,
    skip,
  })
  if (!articles) throw createError({ statusCode: 404, message: 'Článek nenalezen' })

  return articles
})

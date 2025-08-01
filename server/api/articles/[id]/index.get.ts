export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const slug = getRouterParam(event, 'id')
  if (!slug) throw createError({ statusCode: 400, message: 'Slug je povinný' })
  const db = await getEnhancedPrisma(user)
  const article = await db.article.findUnique({
    where: { slug },
    include: {
      user: { select: { username: true, id: true } },
      tags: { include: { tag: true } },
      _count: { select: { comments: { where: { deletedAt: null } } } },
    },
  })

  if (!article) throw createError({ statusCode: 404, message: 'Článek nenalezen' })

  if (article.status !== 'published' && user?.role !== 'admin')
    throw createError({ statusCode: 403, message: 'Nedostupné' })

  return {
    ...article,
    commentCount: article._count.comments,
  }
})

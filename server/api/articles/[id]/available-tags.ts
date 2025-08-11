export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const articleId = getRouterParam(event, 'id')
  if (!articleId)
    throw createError({
      statusCode: 400,
      message: 'ID článku je povinné',
    })
  const db = await getEnhancedPrisma(user)
  const article = await db.article.findUnique({
    where: { id: articleId },
    include: { tags: { select: { tagId: true } } },
  })

  if (!article) throw createError({ statusCode: 404, message: 'Článek nenalezen' })

  const usedTagIds = article.tags.map((t) => t.tagId)

  const availableTags = await db.tag.findMany({
    where: {
      id: { notIn: usedTagIds },
      clientSiteId: user.clientSiteId,
    },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  })

  return availableTags
})

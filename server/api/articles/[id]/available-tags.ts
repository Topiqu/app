export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user)
    throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })

  const articleId = getRouterParam(event, 'id')
  if (!articleId)
    throw createError({
      statusCode: 400,
      statusMessage: 'ID článku je povinné',
    })

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { tags: { select: { tagId: true } } },
  })

  if (!article)
    throw createError({ statusCode: 404, statusMessage: 'Článek nenalezen' })

  const usedTagIds = article.tags.map((t) => t.tagId)

  const availableTags = await prisma.tag.findMany({
    where: {
      id: { notIn: usedTagIds },
      clientSiteId: user.clientSiteId,
    },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  })

  return availableTags
})

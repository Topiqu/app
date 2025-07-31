export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const articleId = getRouterParam(event, 'id')
  if (!articleId) throw createError({ statusCode: 400, message: 'Chybí ID článku' })

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { clientSiteId: true },
  })

  if (!article) throw createError({ statusCode: 404, message: 'Článek nenalezen' })

  return await prisma.emoji.findMany({
    where: { clientSiteId: article.clientSiteId },
    select: { id: true, shortcode: true, imageUrl: true },
  })
})

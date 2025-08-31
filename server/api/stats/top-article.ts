export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const topArticle = await prisma.article.findFirst({
    where: { clientSiteId: user.clientSiteId },
    select: { id: true, title: true, views: true },
    orderBy: { views: 'desc' },
    take: 1,
  })

  return topArticle || null
})

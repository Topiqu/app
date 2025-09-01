export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })
  if (!user.clientSiteId) throw createError({ statusCode: 403, message: 'Uživatel není přiřazen k žádnému ClientSite' })

  const articles = await prisma.article.findMany({
    where: { status: 'published', clientSiteId: user.clientSiteId },
    select: {
      views: true,
      _count: {
        select: {
          reactions: true,
          comments: true,
          shares: true,
        },
      },
      shares: {
        select: {
          id: true,
        },
      },
    },
  })

  const engagementRates = articles
    .filter((a) => a.views > 0)
    .map((a) => (a._count.reactions + a._count.comments + a.shares.length) / a.views)
  const engagementRate =
    engagementRates.length > 0 ? engagementRates.reduce((sum, rate) => sum + rate, 0) / engagementRates.length : 0

  return { engagementRate }
})

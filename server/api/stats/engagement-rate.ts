export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  if (!user.clientSiteId) throw createError({ statusCode: 403, message: t('common.errors.missing')! })

  const articles = await prisma.article.findMany({
    where: { status: 'published', clientSiteId: user.clientSiteId },
    select: {
      views: true,
      _count: {
        select: {
          reactions: true,
          comments: true,
          shares: true,
          pollResults: true,
        },
      },
      shares: { select: { id: true } },
    },
  })

  const engagementRates = articles
    .filter((a) => a.views > 0)
    .map((a) => (a._count.reactions + a._count.comments + a.shares.length + a._count.pollResults) / a.views)
  const engagementRate =
    engagementRates.length > 0 ? engagementRates.reduce((sum, rate) => sum + rate, 0) / engagementRates.length : 0

  return { engagementRate }
})

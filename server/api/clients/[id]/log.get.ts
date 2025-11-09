export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user?.clientSiteId) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const id = getRouterParam(event, 'id')
  if (id !== user.clientSiteId) throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const { take, skip } = await getPagination(event)
  const limitedTake = Math.min(take, 50)

  const logs = await prisma.log.findMany({
    where: {
      clientSiteId: id,
      action: {
        in: [
          'CRON_GENERATE_ARTICLE',
          'CRON_GENERATE_ARTICLE_FAILED',
          'CRON_ARTICLE_PUBLISHED',
          'CRON_ARTICLE_SAVED_AS_DRAFT',
          'COMMUNITY_INSIGHT_GENERATED',
          'COMMUNITY_INSIGHT_SKIPPED',
        ],
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limitedTake + 1,
    skip,
    select: { id: true, action: true, createdAt: true, metadata: true },
  })

  const hasMore = logs.length > limitedTake
  const items = hasMore ? logs.slice(0, limitedTake) : logs

  return {
    items: items.map((log) => ({
      ...log,
      metadata: typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata,
    })),
    hasMore,
  }
})

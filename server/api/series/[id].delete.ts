export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const id = getRouterParam(event, 'id')
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')
  if (!id || !user.clientSiteId) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const db = await getEnhancedPrisma(user)
  const series = await db.articleSeries.findFirst({
    where: { id, clientSiteId: user.clientSiteId },
    select: { id: true, name: true },
  })
  if (!series) throw createError({ statusCode: 404, message: t('common.errors.notFound')! })

  await db.$transaction(async (tx) => {
    await tx.article.updateMany({
      where: { clientSiteId: user.clientSiteId, articleSeriesId: id },
      data: { articleSeriesId: null, seriesOrder: 0 },
    })
    await tx.articleSeries.delete({ where: { id } })
  })

  await invalidateFeed(user.clientSiteId)
  await logAction({
    action: 'ARTICLE_SERIES_DELETE',
    userId: user.id,
    clientSiteId: user.clientSiteId,
    ip: getIp(event),
    metadata: { seriesId: id, name: series.name },
  })

  return { success: true }
})

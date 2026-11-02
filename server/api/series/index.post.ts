import slugify from 'slugify'
import { createSeriesSchema } from '~~/shared/seriesSchemas'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { user, membership } = await requireTenantScope(event, 'ARTICLE_WRITE')
  const db = await getEnhancedPrisma(user)

  const clientSiteId = membership.clientSiteId
  if (!clientSiteId) {
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })
  }

  const body = await readValidatedBody(event, createSeriesSchema.parse)
  const articleIds = [...new Set(body.articleIds)]

  const existing = await db.articleSeries.findFirst({
    where: {
      clientSiteId,
      name: { equals: body.name, mode: 'insensitive' },
    },
    select: { id: true },
  })

  if (existing) {
    throw createError({ statusCode: 409, message: t('series.duplicateName')! })
  }

  const articleWhere = {
    clientSiteId,
    deletedAt: null,
    articleSeriesId: null,
    ...(!hasTenantScope(membership, 'ARTICLE_WRITE_OTHERS') ? { userId: user.id } : {}),
  }

  const newSeries = await db.$transaction(async (tx) => {
    if (articleIds.length) {
      const articles = await tx.article.findMany({
        where: { ...articleWhere, id: { in: articleIds } },
        select: { id: true },
      })
      if (articles.length !== articleIds.length)
        throw createError({ statusCode: 409, message: t('series.articlesUnavailable')! })
    }

    const base = (slugify(body.slug || body.name, { lower: true, strict: true }) || 'series').slice(0, 90)
    const slugs = await tx.articleSeries.findMany({
      where: { clientSiteId, slug: { startsWith: base } },
      select: { slug: true },
    })
    const taken = new Set(slugs.map((series) => series.slug))
    let slug = base
    let suffix = 2
    while (taken.has(slug)) slug = `${base}-${suffix++}`

    const series = await tx.articleSeries.create({
      data: { name: body.name, slug, description: body.description || null, clientSiteId },
      select: { id: true, name: true, slug: true, description: true, createdByAi: true },
    })

    for (const [index, id] of articleIds.entries()) {
      const updated = await tx.article.updateMany({
        where: { ...articleWhere, id },
        data: { articleSeriesId: series.id, seriesOrder: index + 1 },
      })
      // A concurrent series assignment must roll back the entire creation, never move a part silently.
      if (updated.count !== 1) throw createError({ statusCode: 409, message: t('series.articlesUnavailable')! })
    }

    return { ...series, articles: articleIds.map((id) => ({ id })) }
  })

  await invalidateFeed(clientSiteId)
  await logAction({
    action: 'ARTICLE_SERIES_CREATE',
    userId: user.id,
    clientSiteId,
    ip: getIp(event),
    metadata: { seriesId: newSeries.id, articleIds },
  })

  return newSeries
})

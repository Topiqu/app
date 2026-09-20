import { z } from 'zod'

const bodySchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(500).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const id = getRouterParam(event, 'id')
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')
  if (!id || !user.clientSiteId) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const db = await getEnhancedPrisma(user)
  const body = await readValidatedBody(event, bodySchema.parse)
  const current = await db.articleSeries.findFirst({ where: { id, clientSiteId: user.clientSiteId } })
  if (!current) throw createError({ statusCode: 404, message: t('common.errors.notFound')! })

  const duplicate = await db.articleSeries.findFirst({
    where: {
      clientSiteId: user.clientSiteId,
      id: { not: id },
      name: { equals: body.name, mode: 'insensitive' },
    },
    select: { id: true },
  })
  if (duplicate) throw createError({ statusCode: 409, message: t('common.errors.alreadyExists')! })

  const series = await db.articleSeries.update({
    where: { id },
    data: {
      name: body.name,
      ...(body.description !== undefined ? { description: body.description || null } : {}),
    },
    select: { id: true, name: true, slug: true, description: true, createdByAi: true },
  })

  await invalidateFeed(user.clientSiteId)
  await logAction({
    action: 'ARTICLE_SERIES_UPDATE',
    userId: user.id,
    clientSiteId: user.clientSiteId,
    ip: getIp(event),
    metadata: { seriesId: id, updatedFields: Object.keys(body) },
  })

  return series
})

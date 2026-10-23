const bodySchema = TagCreateSchema.pick({ name: true, slug: true })
  .partial()
  .refine((body) => body.name !== undefined || body.slug !== undefined)

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const data = await readValidatedBody(event, bodySchema.parse)
  const db = await getEnhancedPrisma(user)

  const tag = await db.tag.findUnique({ where: { id }, select: { id: true, clientSiteId: true } })
  if (!tag) throw createError({ statusCode: 404, message: t('common.errors.tagNotFound')! })
  if (user.role !== 'superadmin' && tag.clientSiteId !== user.clientSiteId)
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const tenants = await tagFeedTenants(db, tag)
  const updated = await db.tag.update({ where: { id }, data, select: { id: true, name: true, slug: true } })
  for (const tenantId of tenants) await invalidateFeed(tenantId)

  return {
    tag: {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
    },
  }
})

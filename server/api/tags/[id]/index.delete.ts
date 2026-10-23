import { tagFeedTenants } from '~~/server/utils/tagFeeds'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')

  const tagId = getRouterParam(event, 'id')
  if (!tagId) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const db = await getEnhancedPrisma(user)
  const tag = await db.tag.findUnique({ where: { id: tagId }, select: { id: true, clientSiteId: true } })
  if (!tag) throw createError({ statusCode: 404, message: t('common.errors.tagNotFound')! })
  if (user.role !== 'superadmin' && tag.clientSiteId !== user.clientSiteId)
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const tenants = await tagFeedTenants(db, tag)
  await db.tag.delete({ where: { id: tagId } })
  for (const tenantId of tenants) await invalidateFeed(tenantId)
  return { success: true }
})

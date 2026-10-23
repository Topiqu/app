import { decideDraft } from '../../../utils/linkedin/decision'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  // Approval queues the post for the LinkedIn publish cron — the same act as publish/[id].
  const { user, membership } = await requireTenantScope(event, 'INTEGRATION_CONTROL')
  if (!membership.clientSiteId) {
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })
  }
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const db = await getEnhancedPrisma(user)

  const draft = await decideDraft({
    db,
    draftId: id,
    clientSiteId: membership.clientSiteId,
    reviewerId: user.id,
    decision: 'APPROVE',
    translate: (key) => t(key) || undefined,
  })

  return { success: true, draft }
})

import { z } from 'zod'

const bodySchema = z.object({ reason: z.string().trim().min(1).max(500) })

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { user, membership } = await requireTenantScope(event, 'INTEGRATION_CONTROL')
  if (!membership.clientSiteId) {
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })
  }
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const body = await readValidatedBody(event, bodySchema.parse)
  const db = await getEnhancedPrisma(user)

  const draft = await decideDraft({
    db,
    draftId: id,
    clientSiteId: membership.clientSiteId,
    reviewerId: user.id,
    decision: 'REJECT',
    notes: body.reason,
    translate: (key) => t(key) || undefined,
  })

  return { success: true, draft }
})

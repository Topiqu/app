export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  // Approval queues the post for the LinkedIn publish cron — the same act as publish/[id].
  const { user } = await requireTenantScope(event, 'INTEGRATION_CONTROL')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const db = await getEnhancedPrisma(user)

  const draft = await db.draftPost.update({ where: { id }, data: { status: 'APPROVED' } }).catch(() => null)
  if (!draft) throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  await db.approval.create({
    data: {
      draftId: draft.id,
      reviewerId: user.id,
      decision: 'APPROVE',
    },
  })

  return { success: true, draft }
})

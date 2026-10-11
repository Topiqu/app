export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { user } = await requireTenantScope(event, 'INTEGRATION_CONTROL')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const body = await readBody(event)
  const db = await getEnhancedPrisma(user)

  const draft = await db.draftPost.update({ where: { id }, data: { status: 'REJECTED' } }).catch(() => null)
  if (!draft) throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  await db.approval.create({
    data: {
      draftId: draft.id,
      reviewerId: user.id,
      decision: 'REJECT',
      notes: body.reason || null,
    },
  })

  return { success: true, draft }
})

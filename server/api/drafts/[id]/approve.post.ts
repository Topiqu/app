export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const id = getRouterParam(event, 'id')
  const user = (await getServerSession(event))?.user

  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

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

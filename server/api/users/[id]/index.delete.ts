export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  if (user.role !== 'superadmin') throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const userId = getRouterParam(event, 'id')
  if (!userId) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const db = await getEnhancedPrisma(user)
  const targetUser = await db.user.findUnique({ where: { id: userId } })
  if (!targetUser) throw createError({ statusCode: 404, message: t('common.errors.userNotFound')! })

  await db.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  })

  return { message: t('common.messages.successGeneral')! }
})

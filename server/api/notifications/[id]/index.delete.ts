export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  const user = (await getServerSession(event))?.user
  const db = await getEnhancedPrisma(user)

  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.notificationIdRequired')! })

  const notification = await db.notification.findUnique({
    where: { id },
  })

  if (!notification || notification.userId !== user.id)
    throw createError({ statusCode: 404, message: t('common.errors.notificationNotFound')! })

  await db.notification.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
  return { success: true }
})

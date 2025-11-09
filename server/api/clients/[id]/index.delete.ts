export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user

  if (!user || user.role !== 'superadmin')
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const db = await getEnhancedPrisma(user)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const { hard } = getQuery(event)
  const forceDelete = hard === 'true'

  if (forceDelete) {
    await db.user.deleteMany({ where: { clientSiteId: id } })
    await db.clientSite.delete({ where: { id } })
  } else {
    await db.user.updateMany({
      where: { clientSiteId: id },
      data: { deletedAt: new Date() },
    })
    await db.clientSite.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }

  return { success: true }
})

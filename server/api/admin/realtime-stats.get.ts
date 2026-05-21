export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user || user.role !== 'admin') {
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  }

  return realtime.stats()
})

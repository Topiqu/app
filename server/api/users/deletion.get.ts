export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  return deletionPreview(user.id)
})

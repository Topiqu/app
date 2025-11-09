export default defineEventHandler(async (event) => {
  const { translate } = await useServerI18n(event)

  return { message: translate('common.loading') }
})

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  return [
    t('common.errors.streamCreationError', { error: 'random error message' }),
    t('common.errors.streamCreationError'),
  ]
})

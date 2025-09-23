export default defineEventHandler(async (event) => {
  const { translate } = await useServerI18n(event)

  const message = translate('profile.messages.followSuccess')
  const messageArray = translate('profile.messages.followSuccess', ['Jan Novák'])
  const messageObject = translate('profile.messages.followSuccess', { 0: 'Jan Novák' })

  return {
    message,
    messageArray,
    messageObject,
  }
})

import { deleteFromCdn, putToCdn } from '~~/server/utils/storage'
import { AVATAR_CONTENT_TYPE, avatarKeyFromUrl, moderateAvatar, prepareAvatar } from '~~/server/utils/avatar'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const sessionUser = (await getServerSession(event))?.user
  if (!sessionUser) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const parts = await readMultipartFormData(event)
  const file = parts?.find((part) => part.name === 'file')
  if (!file?.data) throw createError({ statusCode: 400, statusMessage: 'No avatar uploaded' })

  const avatar = await prepareAvatar(file.data)
  await moderateAvatar(avatar)

  const config = useRuntimeConfig()
  const current = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { avatarUrl: true } })
  if (!current) throw createError({ statusCode: 404, message: t('common.errors.userNotFound')! })

  const key = `avatars/${sessionUser.id}/${crypto.randomUUID()}.webp`
  const url = await putToCdn(key, avatar, AVATAR_CONTENT_TYPE, { 'user-id': sessionUser.id })

  try {
    await saveUserWithLogging(event, { id: sessionUser.id, avatarUrl: url }, true)
  } catch (error) {
    await deleteFromCdn(key, `avatars/${sessionUser.id}/`).catch((cleanupError) =>
      console.error('Avatar rollback failed:', cleanupError),
    )
    throw error
  }

  const oldKey = avatarKeyFromUrl(current.avatarUrl, config.public.cdnUrl)
  if (oldKey && oldKey !== key)
    deleteFromCdn(oldKey, `avatars/${sessionUser.id}/`).catch((error) =>
      console.error('Old avatar cleanup failed:', error),
    )

  return { avatarUrl: url }
})

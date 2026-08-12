import { deleteFromCdn, putToCdn } from '~~/server/utils/storage'
import { AVATAR_CONTENT_TYPE, avatarKeyFromUrl, moderateAvatar, prepareAvatar } from '~~/server/utils/avatar'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const clientSiteId = getRouterParam(event, 'id')
  if (!clientSiteId) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const parts = await readMultipartFormData(event)
  const file = parts?.find((part) => part.name === 'file')
  if (!file?.data) throw createError({ statusCode: 400, statusMessage: 'No avatar uploaded' })

  const avatar = await prepareAvatar(file.data)
  await moderateAvatar(avatar)

  const { db, user, aiUser } = await resolveAiUser(event, clientSiteId, true)
  const key = `avatars/${aiUser!.id}/${crypto.randomUUID()}.webp`
  const url = await putToCdn(key, avatar, AVATAR_CONTENT_TYPE, { 'user-id': aiUser!.id })

  try {
    await db.user.update({ where: { id: aiUser!.id }, data: { avatarUrl: url } })
  } catch (error) {
    await deleteFromCdn(key, `avatars/${aiUser!.id}/`).catch((cleanupError) =>
      console.error('AI avatar rollback failed:', cleanupError),
    )
    throw error
  }

  await logAction({
    action: 'AI_USER_UPDATE',
    userId: user.id,
    clientSiteId,
    ip: getIp(event),
    metadata: { aiUserId: aiUser!.id, updatedFields: ['avatarUrl'] },
  })

  const oldKey = avatarKeyFromUrl(aiUser!.avatarUrl, useRuntimeConfig().public.cdnUrl)
  if (oldKey && oldKey !== key)
    deleteFromCdn(oldKey, `avatars/${aiUser!.id}/`).catch((error) =>
      console.error('Old AI avatar cleanup failed:', error),
    )

  return { avatarUrl: url }
})

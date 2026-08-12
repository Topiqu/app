import { deleteFromCdn } from '~~/server/utils/storage'
import { avatarKeyFromUrl } from '~~/server/utils/avatar'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const clientSiteId = getRouterParam(event, 'id')
  if (!clientSiteId) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const { db, user, aiUser } = await resolveAiUser(event, clientSiteId)
  if (!aiUser) return { avatarUrl: null }

  await db.user.update({ where: { id: aiUser.id }, data: { avatarUrl: null } })

  await logAction({
    action: 'AI_USER_UPDATE',
    userId: user.id,
    clientSiteId,
    ip: getIp(event),
    metadata: { aiUserId: aiUser.id, updatedFields: ['avatarUrl'] },
  })

  const key = avatarKeyFromUrl(aiUser.avatarUrl, useRuntimeConfig().public.cdnUrl)
  if (key)
    deleteFromCdn(key, `avatars/${aiUser.id}/`).catch((error) =>
      console.error('Removed AI avatar cleanup failed:', error),
    )

  return { avatarUrl: null }
})

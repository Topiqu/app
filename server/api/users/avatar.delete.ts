import { deleteFromCdn } from '~~/server/utils/storage'
import { avatarKeyFromUrl } from '~~/server/utils/avatar'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const sessionUser = (await getServerSession(event))?.user
  if (!sessionUser) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const current = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { avatarUrl: true } })
  if (!current) throw createError({ statusCode: 404, message: t('common.errors.userNotFound')! })

  await saveUserWithLogging(event, { id: sessionUser.id, avatarUrl: null }, true)

  const key = avatarKeyFromUrl(current.avatarUrl, useRuntimeConfig().public.cdnUrl)
  if (key)
    deleteFromCdn(key, `avatars/${sessionUser.id}/`).catch((error) =>
      console.error('Removed avatar cleanup failed:', error),
    )

  return { avatarUrl: null }
})

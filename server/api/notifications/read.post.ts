import { z } from 'zod'

// `before` is the newest notification the reader has seen, so one arriving meanwhile stays unread.
const BodySchema = z.object({ before: z.coerce.date() })

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const { before } = await readValidatedBody(event, BodySchema.parse)
  const db = await getEnhancedPrisma(user)

  await db.notification.updateMany({
    where: { userId: user.id, isRead: false, deletedAt: null, createdAt: { lte: before } },
    data: { isRead: true },
  })

  return { unreadCount: await db.notification.count(buildUnreadCountArgs(user.id)) }
})

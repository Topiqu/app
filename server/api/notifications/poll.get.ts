import { z } from 'zod'

const QuerySchema = z.object({
  since: z.coerce.date().optional(),
  sinceId: z.string().max(200).optional(),
})

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const startedAt = new Date()
  const { since, sinceId } = await getValidatedQuery(event, QuerySchema.parse)
  const db = await getEnhancedPrisma(user)

  const notifications = await db.notification.findMany(buildPollFindArgs(user.id, since, sinceId))
  const unreadCount = await db.notification.count(buildUnreadCountArgs(user.id))

  const last = since && sinceId !== undefined ? notifications.at(-1) : notifications[0]
  return {
    notifications,
    unreadCount,
    cursor: last
      ? notificationCursor(last, startedAt)
      : { createdAt: (since ?? startedAt).toISOString(), id: sinceId ?? '' },
    hasMore: notifications.length === POLL_MAX_BATCH,
  }
})

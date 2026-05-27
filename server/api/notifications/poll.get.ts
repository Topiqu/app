const QuerySchema = z.object({
  since: z.coerce.date().optional(),
})

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const { since } = await getValidatedQuery(event, QuerySchema.parse)
  const db = await getEnhancedPrisma(user)

  const findArgs = buildPollFindArgs(user.id, since)
  const notifications = findArgs ? await db.notification.findMany(findArgs) : []
  const unreadCount = await db.notification.count(buildUnreadCountArgs(user.id))

  return { notifications, unreadCount }
})

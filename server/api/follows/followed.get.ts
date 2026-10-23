import { z } from 'zod'
export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  const { followedId } = await getValidatedQuery(event, querySchema.parse)

  const db = await getEnhancedPrisma(user)
  const following = await db.follow.findMany({
    where: { followerId: user.id, ...(followedId ? { followedId } : {}) },
    take: followedId ? 1 : undefined,
    select: {
      followed: {
        select: { id: true, username: true, role: true, avatarUrl: true, bio: true },
      },
    },
  })

  return following.map((f) => f.followed)
})

const querySchema = z.object({ followedId: z.string().trim().min(1).max(128).optional() })

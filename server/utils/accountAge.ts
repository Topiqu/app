import type { H3Event } from 'h3'

const MIN_AGE_MS = 60 * 1000

export const ensureMinAccountAge = async (event: H3Event, userId: string) => {
  const { translate: t } = await useServerI18n(event)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  })
  if (!user) {
    throw createError({ statusCode: 404, message: t('common.errors.userNotFound') || 'User not found' })
  }
  const ageMs = Date.now() - user.createdAt.getTime()
  if (ageMs < MIN_AGE_MS) {
    throw createError({
      statusCode: 429,
      message: t('common.auth.accountTooNew') || 'Account too new for this action',
    })
  }
}

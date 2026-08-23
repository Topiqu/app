// The audit log records far more than the account owner needs to see; this is the subset that
// tells them "is someone else in my account" — logins, revoked devices, credential and role changes.
const SECURITY_ACTIONS = ['SESSION_CREATE', 'SESSION_REVOKE', 'PASSWORD_CHANGE', 'PASSWORD_SET', 'ROLE_CHANGE']

const EVENT_LIMIT = 20

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  // `Log` policy already scopes reads to `auth().id == userId`; the explicit filter keeps the
  // query narrow rather than being the isolation itself.
  const db = await getEnhancedPrisma(user)
  const logs = await db.log.findMany({
    where: { userId: user.id, action: { in: SECURITY_ACTIONS } },
    orderBy: { createdAt: 'desc' },
    take: EVENT_LIMIT,
    select: { id: true, action: true, createdAt: true, ip: true, metadata: true },
  })

  return logs.map((log) => {
    // Whitelist by construction: `metadata` also carries sessionIds, target userIds and roles,
    // none of which belong in a client payload.
    const meta = (typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata) ?? {}
    return {
      id: log.id,
      action: log.action,
      createdAt: log.createdAt.toISOString(),
      ip: log.ip,
      device: [meta.device, meta.os, meta.browser].filter(Boolean).join(' · ') || null,
      location: [meta.city, meta.country].filter(Boolean).join(', ') || null,
    }
  })
})

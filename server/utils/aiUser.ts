import type { H3Event } from 'h3'

// Older publications may predate the default editorial author.
export async function resolveAiUser(event: H3Event, clientSiteId: string, create = false) {
  const { translate: t } = await useServerI18n(event)
  const user = await getSessionUser(event)
  if (!user || !['admin', 'superadmin'].includes(user.role))
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  // ZenStack lets any admin write any User row, so tenancy is pinned here rather than by policy.
  if (user.role !== 'superadmin' && user.clientSiteId !== clientSiteId)
    throw createError({ statusCode: 403, message: t('common.errors.unauthorized')! })
  if (user.role !== 'superadmin') await requireTenantScope(event, 'TENANT_SETTINGS', clientSiteId)

  const db = await getEnhancedPrisma(user)
  const site = await db.clientSite.findUnique({ where: { id: clientSiteId }, select: { id: true } })
  if (!site) throw createError({ statusCode: 404, message: t('common.errors.clientNotFound')! })

  const existing = await db.user.findFirst({
    where: { clientSiteId, role: 'ai', deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, avatarUrl: true },
  })
  if (existing || !create) return { db, user, aiUser: existing }

  const aiUser = await ensureAiAuthor(clientSiteId)

  return { db, user, aiUser }
}

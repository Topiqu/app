import type { H3Event } from 'h3'
import type { SessionRole as Role } from '~~/shared/types/auth'

const ROLE_RANK: Record<Role, number> = { reader: 0, ai: 0, admin: 1, superadmin: 2 }

interface RequireUserOptions {
  minRole?: Role
  role?: Role | Role[]
  clientSite?: boolean
}

export const requireUser = async (event: H3Event, opts: RequireUserOptions = {}): Promise<SessionUser> => {
  const { translate: t } = await useServerI18n(event)
  const user = await getSessionUser(event)

  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  if (opts.minRole && ROLE_RANK[user.role] < ROLE_RANK[opts.minRole])
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  if (opts.role) {
    const allowed = Array.isArray(opts.role) ? opts.role : [opts.role]
    if (!allowed.includes(user.role)) throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })
  }

  if (opts.clientSite && !user.clientSiteId)
    throw createError({ statusCode: 403, message: t('common.errors.missing')! })

  return user
}

export const requireDb = async (event: H3Event, opts: RequireUserOptions = {}) => {
  const user = await requireUser(event, opts)
  return { user, db: await getEnhancedPrisma(user) }
}

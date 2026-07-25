import type { H3Event } from 'h3'
import type { User } from 'next-auth'

type Role = User['role']

const ROLE_RANK: Record<Role, number> = { reader: 0, ai: 0, admin: 1, superadmin: 2 }

interface RequireUserOptions {
  minRole?: Role
  role?: Role | Role[]
  clientSite?: boolean
}

const resolveUser = async (event: H3Event): Promise<User | undefined> => {
  if (event.context.authUser) return event.context.authUser as User
  const user = (await getServerSession(event))?.user
  if (user) event.context.authUser = user
  return user
}

export const requireUser = async (event: H3Event, opts: RequireUserOptions = {}): Promise<User> => {
  const { translate: t } = await useServerI18n(event)
  const user = await resolveUser(event)

  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  if (opts.minRole && ROLE_RANK[user.role] < ROLE_RANK[opts.minRole])
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  if (opts.role) {
    const allowed = Array.isArray(opts.role) ? opts.role : [opts.role]
    if (!allowed.includes(user.role))
      throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })
  }

  if (opts.clientSite && !user.clientSiteId)
    throw createError({ statusCode: 403, message: t('common.errors.missing')! })

  return user
}

export const requireDb = async (event: H3Event, opts: RequireUserOptions = {}) => {
  const user = await requireUser(event, opts)
  return { user, db: await getEnhancedPrisma(user) }
}

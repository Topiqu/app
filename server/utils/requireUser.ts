import type { H3Event } from 'h3'
import type { User } from 'next-auth'

type Role = User['role']

interface RequireUserOptions {
  role?: Role | Role[]
  clientSite?: boolean
}

export const requireUser = async (event: H3Event, opts: RequireUserOptions = {}): Promise<User> => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user

  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  if (opts.role) {
    const allowed = Array.isArray(opts.role) ? opts.role : [opts.role]
    if (!allowed.includes(user.role))
      throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })
  }

  if (opts.clientSite && !user.clientSiteId)
    throw createError({ statusCode: 403, message: t('common.errors.missing')! })

  return user
}

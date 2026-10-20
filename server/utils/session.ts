import type { SessionUser } from '~~/shared/types/auth'

import { UAParser } from 'ua-parser-js'

import { clientIp } from './ip'
import { TENANT_SCOPES } from './tenantMembership'

type RequestHeaders = Record<string, string | string[] | undefined>

export const headerRecord = (headers: Headers | undefined): RequestHeaders =>
  headers ? Object.fromEntries(headers.entries()) : {}

/** Device and location columns for a new `Session` row. */
export const sessionDevice = async (headers: RequestHeaders) => {
  const ip = clientIp(headers) ?? null
  const rawUserAgent = headers['user-agent']
  const userAgent = (Array.isArray(rawUserAgent) ? rawUserAgent[0] : rawUserAgent)?.slice(0, 500) || null
  const { device, os, browser } = new UAParser(userAgent ?? undefined).getResult()

  return {
    ip,
    userAgent,
    device: (device?.model ?? device?.vendor ?? device?.type ?? 'Desktop').slice(0, 100),
    os: os?.name ? `${os.name} ${os.version ?? ''}`.trim().slice(0, 100) : null,
    browser: browser?.name ? `${browser.name} ${browser.version ?? ''}`.trim().slice(0, 100) : null,
    ...(ip ? await resolveGeo(ip) : { city: null, region: null, country: null }),
  }
}

/** The tenant a new session opens in: the last one used, else the user's home site, else the oldest membership. */
export const initialTenant = async (userId: string): Promise<string | null> => {
  const [lastSession, user, memberships] = await Promise.all([
    prisma.session.findFirst({
      where: { userId, clientSiteId: { not: null } },
      orderBy: { lastUsedAt: 'desc' },
      select: { clientSiteId: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { clientSiteId: true } }),
    prisma.tenantMembership.findMany({
      where: { userId, deletedAt: null, clientSite: { deletedAt: null } },
      select: { clientSiteId: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])
  const ids = memberships.map((membership) => membership.clientSiteId)

  return [lastSession?.clientSiteId, user?.clientSiteId].find((id) => id && ids.includes(id)) ?? ids[0] ?? null
}

export const uniqueUsername = async (name: string | undefined, email: string) => {
  const base = (name || email.split('@')[0] || '').trim().slice(0, 36)
  const username = base.length >= 3 ? base : 'user'
  const taken = await prisma.user.findUnique({ where: { username }, select: { id: true } })
  return taken ? `${username}_${Date.now()}` : username
}

/** Resolves role, plan and tenant from the session's active tenant on every read, as the JWT callback did. */
export const toSessionUser = async (
  user: { id: string; name: string; email: string; image?: string | null; role?: string | null },
  session: { id: string; clientSiteId?: string | null },
): Promise<SessionUser> => {
  const membership = session.clientSiteId
    ? await prisma.tenantMembership.findUnique({
        where: { clientSiteId_userId: { clientSiteId: session.clientSiteId, userId: user.id } },
        select: { deletedAt: true, role: true, scopes: true, clientSite: { select: { plan: true, deletedAt: true } } },
      })
    : null
  const active = membership !== null && membership.deletedAt === null && membership.clientSite.deletedAt === null
  if (session.clientSiteId && !active)
    await prisma.session.update({ where: { id: session.id }, data: { clientSiteId: null } })

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === 'superadmin' ? 'superadmin' : active ? 'admin' : 'reader',
    clientSiteId: active ? session.clientSiteId! : '',
    plan: active ? membership.clientSite.plan : 'BASIC',
    scopes:
      user.role === 'superadmin' || (active && membership.role === 'OWNER')
        ? [...TENANT_SCOPES]
        : active
          ? membership.scopes
          : [],
    avatarUrl: user.image ?? null,
    sessionId: session.id,
  }
}

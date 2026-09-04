import type { H3Event } from 'h3'

// Compiled browser tests run with NODE_ENV=production, but still use loopback HTTP.
// Keep their cookies host-only and non-secure just like the auth handler does.
const isProduction = process.env.NODE_ENV === 'production' && !process.env.TEST_DATABASE_URL

export const sessionCookieName = `${isProduction ? '__Secure-' : ''}next-auth.session-token`

// TODO: For strict multi-tenant (isolated accounts), set this to undefined to prevent session sharing across domains.
export const sessionCookieDomain = isProduction ? '.topiqu.com' : undefined

interface SessionLookup {
  session: {
    findFirst: (args: {
      where: { id: string; userId: string }
      select: { revoked: true; deletedAt: true }
    }) => Promise<{ revoked: boolean; deletedAt: Date | null } | null>
  }
}

export const isSessionActive = async (db: SessionLookup, sessionId: string, userId: string): Promise<boolean> => {
  const session = await db.session.findFirst({
    where: { id: sessionId, userId },
    select: { revoked: true, deletedAt: true },
  })

  return session !== null && !session.revoked && session.deletedAt === null
}

const belongsToSession = (cookieName: string, base: string) => cookieName === base || cookieName.startsWith(`${base}.`)

const cookieNames = (raw: string | undefined) => (raw ?? '').split(';').map((part) => part.trim().split('=')[0] ?? '')

export const findSessionCookies = (raw: string | undefined, name: string): string[] =>
  cookieNames(raw).filter((cookieName) => belongsToSession(cookieName, name))

export const stripCookie = (raw: string | undefined, name: string): string | undefined => {
  if (!raw) return undefined

  const remaining = raw
    .split(';')
    .filter((part) => !belongsToSession(part.trim().split('=')[0] ?? '', name))
    .join(';')
    .trim()

  return remaining || undefined
}

export const dropSessionCookie = (event: H3Event) => {
  const raw = event.node.req.headers.cookie
  const present = findSessionCookies(raw, sessionCookieName)
  const remaining = stripCookie(raw, sessionCookieName)

  if (remaining) event.node.req.headers.cookie = remaining
  else delete event.node.req.headers.cookie

  for (const name of present) {
    deleteCookie(event, name, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: isProduction,
      domain: sessionCookieDomain,
    })
  }
}

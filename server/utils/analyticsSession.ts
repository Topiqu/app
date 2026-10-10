import type { H3Event } from 'h3'

import { randomUUID } from 'node:crypto'
import { deleteCookie, getCookie, setCookie } from 'h3'

// Optional measurement must not reuse the identity needed for votes and reactions.
const COOKIE = 'analytics_session'

export const issueAnalyticsSession = (event: H3Event) => {
  const existing = getCookie(event, COOKIE)
  if (existing) return existing
  const id = randomUUID()
  setCookie(event, COOKIE, id, {
    maxAge: 30 * 24 * 60 * 60,
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax',
    path: '/',
  })
  return id
}

export const clearAnalyticsSession = (event: H3Event) => deleteCookie(event, COOKIE, { path: '/' })

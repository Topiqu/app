import type { H3Event } from 'h3'

import { randomUUID } from 'node:crypto'

const COOKIE = 'anon_session'

// One definition of the attributes: several endpoints write this cookie, and two of them setting it
// with different flags would flap it on every other request.
const COOKIE_OPTIONS = {
  maxAge: 30 * 24 * 60 * 60,
  httpOnly: true,
  sameSite: 'lax',
  secure: !import.meta.dev,
  path: '/',
} as const

/** Read-only: a GET must not mint an identity, or every crawler walks away with one. */
export const readAnonSession = (event: H3Event) => getCookie(event, COOKIE) ?? null

/**
 * The visitor identity is server-issued, never read from the body: the whole point of the dedup
 * indexes behind views, votes and reactions is that the caller cannot pick which row it collides
 * with.
 */
export const issueAnonSession = (event: H3Event) => {
  const existing = readAnonSession(event)
  if (existing) return existing

  const issued = randomUUID()
  setCookie(event, COOKIE, issued, COOKIE_OPTIONS)
  return issued
}

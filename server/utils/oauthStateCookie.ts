import type { H3Event } from 'h3'

import { sessionCookieDomain } from './sessionGuard'

// Every OAuth connect starts on the tenant's own host — `middleware/admin.ts` pushes admins there —
// while the provider redirects back to APP_URL, i.e. app.topiqu.com. A host-only cookie is never sent
// to that callback, so the state check rejected every connect as forged. Scope it like the session
// cookie: what survives the hop for auth has to survive it for the CSRF token too.
const options = {
  httpOnly: true,
  secure: !import.meta.dev,
  sameSite: 'lax',
  path: '/',
  domain: sessionCookieDomain,
} as const

export const setOAuthState = (event: H3Event, name: string, state: string, maxAge: number) =>
  setCookie(event, name, state, { ...options, maxAge })

/** Reads the state and clears it — the cookie is single-use, and `deleteCookie` only matches with the same domain/path. */
export const takeOAuthState = (event: H3Event, name: string) => {
  const state = getCookie(event, name)
  deleteCookie(event, name, options)
  return state
}

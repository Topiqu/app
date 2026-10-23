import type { H3Event } from 'h3'

// Confirmation and provider callbacks both run on the central origin. Host-only cookies also
// prevent another managed subdomain from injecting the callback's CSRF state.
const options = {
  httpOnly: true,
  secure: isSecureAuth,
  sameSite: 'lax',
  path: '/',
} as const
const cookieName = (name: string) => `${isSecureAuth ? '__Host-' : ''}${name}`

export const setOAuthState = (event: H3Event, name: string, state: string, maxAge: number) =>
  setCookie(event, cookieName(name), state, { ...options, maxAge })

/** Reads the state and clears it — the cookie is single-use, and `deleteCookie` only matches with the same domain/path. */
export const takeOAuthState = (event: H3Event, name: string) => {
  const state = getCookie(event, cookieName(name))
  deleteCookie(event, cookieName(name), options)
  return state
}

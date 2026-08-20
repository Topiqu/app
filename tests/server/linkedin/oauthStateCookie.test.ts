import { beforeEach, describe, expect, it, vi } from 'vitest'

const setCookie = vi.fn()
const deleteCookie = vi.fn()
const getCookie = vi.fn(() => 'state-value')

vi.mock('../../../server/utils/sessionGuard', () => ({ sessionCookieDomain: '.topiqu.com' }))

describe('OAuth state cookie', () => {
  beforeEach(() => {
    vi.resetModules()
    setCookie.mockClear()
    deleteCookie.mockClear()
    vi.stubGlobal('setCookie', setCookie)
    vi.stubGlobal('deleteCookie', deleteCookie)
    vi.stubGlobal('getCookie', getCookie)
  })

  const load = () => import('../../../server/utils/oauthStateCookie')

  // The connect runs on the tenant's host, the callback on app.topiqu.com. A host-only cookie never
  // arrives, and every connect is then rejected as a forged state.
  it('scopes the cookie to the session domain so it survives the tenant → app host hop', async () => {
    const { setOAuthState } = await load()
    setOAuthState({} as never, 'linkedin_oauth_state', 'signed', 300)

    expect(setCookie).toHaveBeenCalledWith(
      {},
      'linkedin_oauth_state',
      'signed',
      expect.objectContaining({ domain: '.topiqu.com', httpOnly: true, sameSite: 'lax', path: '/', maxAge: 300 }),
    )
  })

  it('clears with the same domain and path, or the cookie outlives its single use', async () => {
    const { takeOAuthState } = await load()
    expect(takeOAuthState({} as never, 'gsc_oauth_state')).toBe('state-value')

    expect(deleteCookie).toHaveBeenCalledWith(
      {},
      'gsc_oauth_state',
      expect.objectContaining({ domain: '.topiqu.com', path: '/' }),
    )
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/authCookie'), 'isSecureAuth')
}

const setCookie = vi.fn()
const deleteCookie = vi.fn()
const getCookie = vi.fn(() => 'state-value')

vi.mock('../../../server/utils/authCookie', () => ({ isSecureAuth: true }))

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

  it('keeps central confirmation state host-only and secure', async () => {
    const { setOAuthState } = await load()
    setOAuthState({} as never, 'linkedin_oauth_state', 'signed', 300)

    expect(setCookie).toHaveBeenCalledWith({}, '__Host-linkedin_oauth_state', 'signed', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 300,
    })
  })

  it('clears with the same host-only path', async () => {
    const { takeOAuthState } = await load()
    expect(takeOAuthState({} as never, 'gsc_oauth_state')).toBe('state-value')

    expect(deleteCookie).toHaveBeenCalledWith({}, '__Host-gsc_oauth_state', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    })
  })
})

beforeEach(stubImports)

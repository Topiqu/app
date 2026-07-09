import { beforeEach, describe, expect, it, vi } from 'vitest'

import { signOAuthState, verifyOAuthState } from '../../../server/utils/linkedin/oauthState'

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.stubEnv('AUTH_SECRET', 'test-secret')
})

describe('oauthState — sign & verify', () => {
  it('round-trips a valid payload', () => {
    const state = signOAuthState({ nonce: 'n1', clientSiteId: 'site-1', appType: 'personal' })
    expect(verifyOAuthState(state)).toEqual({ nonce: 'n1', clientSiteId: 'site-1', appType: 'personal' })
  })

  it('rejects a tampered clientSiteId (signature no longer matches)', () => {
    const state = signOAuthState({ nonce: 'n1', clientSiteId: 'site-1', appType: 'personal' })
    const [body, sig] = state.split('.')
    const forged = Buffer.from(
      JSON.stringify({ nonce: 'n1', clientSiteId: 'victim-site', appType: 'personal' }),
    ).toString('base64url')

    expect(verifyOAuthState(`${forged}.${sig}`)).toBeNull()
    expect(body).not.toEqual(forged)
  })

  it('rejects a state signed with a different secret', () => {
    const state = signOAuthState({ nonce: 'n1', clientSiteId: 'site-1', appType: 'pages' })
    vi.stubEnv('AUTH_SECRET', 'another-secret')
    expect(verifyOAuthState(state)).toBeNull()
  })

  it('rejects malformed / empty input', () => {
    expect(verifyOAuthState(undefined)).toBeNull()
    expect(verifyOAuthState('')).toBeNull()
    expect(verifyOAuthState('nodot')).toBeNull()
  })

  it('rejects a correctly-signed state carrying an unknown appType', () => {
    const state = signOAuthState({
      nonce: 'n1',
      clientSiteId: 'site-1',
      appType: 'evil' as 'personal',
    })
    expect(verifyOAuthState(state)).toBeNull()
  })
})

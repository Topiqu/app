import { describe, expect, it } from 'vitest'

import { authErrorKey, authErrorRedirect } from '../../../shared/utils/authError'

describe('client auth errors', () => {
  it('preserves the unverified account reason across the Czech redirect', () => {
    const url = new URL(authErrorRedirect('oauth_local_account_unverified', 'cs'), 'https://app.topiqu.com')
    expect(url.pathname).toBe('/cs/autorizace')
    expect(authErrorKey(url.searchParams.get('error'))).toBe('common.auth.localEmailUnverified')
  })

  it('explains a missing verified provider email', () => {
    const url = new URL(authErrorRedirect('oauth_email_unverified', 'en'), 'https://app.topiqu.com')
    expect(url.pathname).toBe('/en/auth')
    expect(authErrorKey(url.searchParams.get('error'))).toBe('common.auth.providerEmailUnverified')
  })

  it('does not reflect arbitrary server messages or redirect destinations', () => {
    expect(authErrorRedirect('secret https://untrusted.example', '//untrusted.example')).toBe(
      '/en/auth?error=OAuthCallback',
    )
    expect(authErrorKey('<script>')).toBe('common.auth.oauthFailed')
    expect(authErrorKey(['oauth_local_account_unverified'])).toBe('common.auth.oauthFailed')
  })

  it('does not show an error for ordinary sign-in navigation', () => {
    expect(authErrorRedirect(undefined, 'cs')).toBe('/cs/autorizace')
    expect(authErrorKey(undefined)).toBeUndefined()
  })
})

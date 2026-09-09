export function authErrorKey(error: unknown): string | undefined {
  if (!error) return undefined
  if (error === 'oauth_local_account_unverified' || error === 'email_not_verified')
    return 'common.auth.localEmailUnverified'
  if (error === 'oauth_email_unverified') return 'common.auth.providerEmailUnverified'
  return 'common.auth.oauthFailed'
}

export function authErrorRedirect(error: unknown, locale: unknown): string {
  const path = locale === 'cs' ? '/cs/autorizace' : '/en/auth'
  if (!error) return path
  const safe =
    error === 'oauth_local_account_unverified' || error === 'oauth_email_unverified' || error === 'email_not_verified'
      ? error
      : 'OAuthCallback'
  return `${path}?error=${safe}`
}

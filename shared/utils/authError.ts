import { authPath } from './routes'
import { isLanguage } from './language'

// Better Auth redirects OAuth failures here with its own codes; only these map to a specific message.
const codes: Record<string, string> = {
  account_not_linked: 'oauth_local_account_unverified',
  oauth_local_account_unverified: 'oauth_local_account_unverified',
  email_not_verified: 'email_not_verified',
  email_not_found: 'oauth_email_unverified',
  oauth_email_unverified: 'oauth_email_unverified',
}

export function authErrorKey(error: unknown): string | undefined {
  if (!error) return undefined
  if (error === 'oauth_local_account_unverified' || error === 'email_not_verified')
    return 'common.auth.localEmailUnverified'
  if (error === 'oauth_email_unverified') return 'common.auth.providerEmailUnverified'
  return 'common.auth.oauthFailed'
}

export function authErrorRedirect(error: unknown, locale: unknown): string {
  const language = isLanguage(locale) ? locale : 'en'
  const path = authPath(language)
  if (!error) return path
  const code = typeof error === 'string' && Object.hasOwn(codes, error) ? codes[error] : 'OAuthCallback'
  return `${path}?error=${code}`
}

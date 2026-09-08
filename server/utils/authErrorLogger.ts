import * as Sentry from '@sentry/nuxt'

import { logger } from './logger'
import { sanitizeAuthErrorMessage } from './authErrorMessage'

// Never forward NextAuth metadata: it can contain profiles, tokens and request bodies.
export function logAuthError(code: string, metadata: unknown) {
  const details = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {}
  const error = details.error ?? metadata
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : typeof error === 'string'
        ? error
        : ''
  const errorMessage = sanitizeAuthErrorMessage(message)
  const provider = details.providerId === 'github' || details.providerId === 'google' ? details.providerId : 'unknown'
  const reason =
    message.match(
      /\b(?:invalid_client|invalid_grant|access_denied|redirect_uri_mismatch|bad_verification_code|incorrect_client_credentials|oauth_email_unverified|oauth_local_account_unverified)\b/,
    )?.[0] ??
    message.match(
      /(?:State cookie was missing|PKCE code_verifier cookie was missing|state mismatch|checks.state argument is missing|outgoing request timed out|fetch failed)/i,
    )?.[0] ??
    message.match(/GitHub (?:profile|emails) (?:HTTP \d{3}|request failed|invalid response)/)?.[0] ??
    'unclassified_auth_error'
  const safeCode = /^[A-Z_]+$/.test(code) ? code : 'AUTH_ERROR'
  const safeError = new Error(`${safeCode}: ${reason === 'unclassified_auth_error' ? errorMessage || reason : reason}`)
  void logger.error(`[auth] ${safeError.message}`, {
    source: 'auth',
    code: safeCode,
    provider,
    reason,
    errorMessage,
  })
  Sentry.withScope((scope) => {
    // Callback URLs and inherited HTTP breadcrumbs can carry authorization codes.
    scope.clearBreadcrumbs()
    scope.addEventProcessor((event) => {
      delete event.request
      delete event.user
      delete event.extra
      delete event.contexts
      return event
    })
    scope.setTag('auth.code', safeCode)
    scope.setTag('auth.provider', provider)
    scope.setTag('auth.reason', reason)
    scope.setFingerprint(['auth', safeCode, provider, reason])
    Sentry.captureException(safeError)
  })
}

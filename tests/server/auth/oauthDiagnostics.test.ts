import { afterEach, describe, expect, it, vi } from 'vitest'

import { logAuthError } from '../../../server/utils/authErrorLogger'
import { fetchGitHubOAuthResource } from '../../../server/utils/githubOAuth'
import { sanitizeAuthErrorMessage } from '../../../server/utils/authErrorMessage'

const betterStack = vi.hoisted(() => ({ error: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../../server/utils/logger', () => ({ logger: betterStack }))

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(),
  scope: { clearBreadcrumbs: vi.fn(), addEventProcessor: vi.fn(), setTag: vi.fn(), setFingerprint: vi.fn() },
}))
vi.mock('@sentry/nuxt', () => ({
  captureException: sentry.captureException,
  withScope: (callback: (scope: typeof sentry.scope) => void) => callback(sentry.scope),
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('OAuth diagnostics', () => {
  it('reports nested callback errors without copying tokens or profile metadata', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    logAuthError('OAUTH_CALLBACK_ERROR', {
      providerId: 'github',
      error: new Error('invalid_client secret=private'),
      tokens: { access_token: 'private' },
      OAuthProfile: { email: 'private@example.com' },
    })
    expect(sentry.captureException.mock.calls[0][0].message).toBe('OAUTH_CALLBACK_ERROR: invalid_client')
    expect(sentry.scope.setTag).toHaveBeenCalledWith('auth.provider', 'github')
    expect(betterStack.error).toHaveBeenCalledWith('[auth] OAUTH_CALLBACK_ERROR: invalid_client', {
      source: 'auth',
      code: 'OAUTH_CALLBACK_ERROR',
      provider: 'github',
      reason: 'invalid_client',
      errorMessage: 'invalid_client secret=[redacted]',
    })
    const process = sentry.scope.addEventProcessor.mock.calls[0][0]
    expect(process({ request: { url: '?code=private' }, user: {}, extra: {}, contexts: {} })).toEqual({})
  })

  it('preserves an unexpected exception message while redacting credentials', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    logAuthError('OAUTH_CALLBACK_ERROR', new Error('expected 200 OK, got: 401 Unauthorized token private'))
    expect(sentry.captureException.mock.calls[0][0].message).toBe(
      'OAUTH_CALLBACK_ERROR: expected 200 OK, got: 401 Unauthorized token [redacted]',
    )
    expect(betterStack.error.mock.calls[0][1].errorMessage).toBe(
      'expected 200 OK, got: 401 Unauthorized token [redacted]',
    )
  })

  it('removes URLs, emails, authorization values and structured secrets', () => {
    const result = sanitizeAuthErrorMessage(
      'failed https://example.com/callback?code=private user@example.com Bearer private {"client_secret":"private", "state":"private"} ghp_private',
    )
    expect(result).not.toContain('private')
    expect(result).not.toContain('user@example.com')
  })

  it('redacts configured secrets even without a label and limits message length', () => {
    vi.stubEnv('AUTH_GITHUB_SECRET', 'test-sensitive-value')
    expect(sanitizeAuthErrorMessage('failed test-sensitive-value')).toBe('failed [redacted]')
    expect(sanitizeAuthErrorMessage('word '.repeat(200)).length).toBe(600)
    vi.unstubAllEnvs()
  })

  it('reports GitHub email HTTP failure instead of treating it as an empty email list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private response', { status: 403 })))
    await expect(fetchGitHubOAuthResource('emails', 'secret')).rejects.toThrow('GitHub emails HTTP 403')
  })

  it('sends an explicit user agent and returns successful responses', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 12 })))
    vi.stubGlobal('fetch', fetcher)
    expect(await fetchGitHubOAuthResource('profile', 'secret')).toEqual({ id: 12 })
    expect(fetcher.mock.calls[0][1].headers['User-Agent']).toBe('Topiqu')
  })

  it('rejects malformed email responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))
    await expect(fetchGitHubOAuthResource('emails', 'secret')).rejects.toThrow('GitHub emails invalid response')
  })
})

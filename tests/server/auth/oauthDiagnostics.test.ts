import { afterEach, describe, expect, it, vi } from 'vitest'

import { logAuthError } from '../../../server/utils/authErrorLogger'
import { fetchGitHubOAuthResource } from '../../../server/utils/githubOAuth'

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
    const process = sentry.scope.addEventProcessor.mock.calls[0][0]
    expect(process({ request: { url: '?code=private' }, user: {}, extra: {}, contexts: {} })).toEqual({})
  })

  it('does not leak arbitrary error messages', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    logAuthError('OAUTH_CALLBACK_ERROR', new Error('private token value'))
    expect(sentry.captureException.mock.calls[0][0].message).toBe('OAUTH_CALLBACK_ERROR: unclassified_auth_error')
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

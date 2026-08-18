import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('GET /api/linkedin/connect', () => {
  let query: Record<string, unknown>

  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.stubEnv('AUTH_SECRET', 'test-secret')
    vi.stubEnv('APP_URL', 'https://app.topiqu.com')
    vi.stubEnv('LINKEDIN_CLIENT_ID_PERSONAL', 'personal-client')
    vi.stubEnv('LINKEDIN_CLIENT_ID_COMPANY', 'company-client')

    query = {}
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('getServerSession', async () => ({ user: { role: 'admin', clientSiteId: 'site-1' } }))
    vi.stubGlobal('requireTenantScope', vi.fn())
    vi.stubGlobal('getQuery', () => query)
    vi.stubGlobal('createError', (e: { statusCode: number; message: string }) => Object.assign(new Error(e.message), e))
    vi.stubGlobal('setCookie', vi.fn())
    vi.stubGlobal('sendRedirect', (_event: unknown, url: string) => url)
  })

  const run = async () => (await import('../../../server/api/linkedin/connect.get')).default({} as never)

  it('refuses a Company Page connect — Community Management API is not approved for the org', async () => {
    query.appType = 'pages'
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
  })

  it('requests only member scopes, so no approval-gated product is touched', async () => {
    const scope = new URL(await run()).searchParams.get('scope')
    expect(scope).toBe('openid profile email w_member_social')
    expect(scope).not.toMatch(/organization/)
  })

  it('always authorizes against the personal app credentials', async () => {
    expect(new URL(await run()).searchParams.get('client_id')).toBe('personal-client')
  })
})

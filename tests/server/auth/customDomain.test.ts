import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/logger'), 'logger')
  await stubNitroImports(import('../../../server/utils/authErrorMessage'), 'sanitizeAuthErrorMessage')
  await stubNitroImports(import('../../../server/utils/authErrorLogger'), 'logAuthError')
  await stubNitroImports(import('../../../server/utils/ip'), 'clientIp')
  await stubNitroImports(import('../../../server/utils/tenantMembership'), 'TENANT_SCOPES')
  await stubNitroImports(
    import('../../../server/utils/session'),
    'headerRecord',
    'initialTenant',
    'sessionDevice',
    'toSessionUser',
    'uniqueUsername',
  )
  await stubNitroImports(import('../../../server/utils/authCookie'), 'isSecureAuth', 'sessionCookieDomain')
}

const factory = vi.hoisted(() => vi.fn((options: unknown) => ({ options, api: {} })))
vi.mock('better-auth', () => ({ betterAuth: factory }))
vi.mock('@zenstackhq/better-auth', () => ({ zenstackAdapter: () => ({}) }))
vi.mock('../../../server/utils/authCookie', () => ({ isSecureAuth: true, sessionCookieDomain: '.topiqu.com' }))
const lookup = vi.fn()
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubEnv('AUTH_SECRET', 'synthetic-auth-secret-for-host-isolation-only')
  vi.stubGlobal('useRuntimeConfig', () => ({ auth: { secret: 'synthetic-auth-secret-for-host-isolation-only' } }))
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('getRequestURL', (event: { url: string }) => new URL(event.url))
  vi.stubGlobal('isPlatformAuthHost', (host: string) => host === 'app.topiqu.com')
  vi.stubGlobal('prisma', { $options: {}, $setOptions: () => ({}), clientSite: { findFirst: lookup } })
  lookup.mockResolvedValue({ id: 'tenant-one' })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
const instance = async (url: string) => {
  const { authForEvent } = await import('../../../server/utils/auth')
  return (await authForEvent({ url } as never)) as unknown as {
    options: {
      secret: string
      baseURL: string
      trustedOrigins: string[]
      advanced: { crossSubDomainCookies: { enabled: boolean; domain?: string } }
    }
  }
}
describe('custom-domain authentication isolation', () => {
  it('keeps platform sharing but uses host-only cookies and exact origin trust for a custom host', async () => {
    const platform = await instance('https://app.topiqu.com')
    expect(platform.options.advanced.crossSubDomainCookies).toMatchObject({ enabled: true, domain: 'topiqu.com' })
    const custom = await instance('https://blog.example.test')
    expect(custom.options.advanced.crossSubDomainCookies).toEqual({ enabled: false, domain: undefined })
    expect(custom.options.trustedOrigins).toEqual(['https://blog.example.test'])
    expect(custom.options.baseURL).toBe('https://blog.example.test')
    expect(custom.options.secret).not.toBe(platform.options.secret)
  })
  it('signs cookies separately for each origin and each tenant owning that domain', async () => {
    const first = await instance('https://blog.example.test')
    const otherHost = await instance('https://other.example.test')
    expect(first.options.secret).not.toBe(otherHost.options.secret)
    lookup.mockResolvedValue({ id: 'new-owner' })
    const newOwner = await instance('https://blog.example.test')
    expect(first.options.secret).not.toBe(newOwner.options.secret)
  })
  it('rechecks domain verification even when an instance is cached', async () => {
    await instance('https://blog.example.test')
    lookup.mockResolvedValue(null)
    await expect(instance('https://blog.example.test')).rejects.toMatchObject({ statusCode: 403 })
  })
  it('rejects plain HTTP for custom domains in production', async () => {
    await expect(instance('http://blog.example.test')).rejects.toMatchObject({ statusCode: 403 })
  })
})

beforeEach(stubImports)

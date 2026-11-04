import type { H3Event } from 'h3'

import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { cachedTenantByHost, domainRedirectTarget } from '../../server/utils/tenant'

mockNuxtImport('useRuntimeConfig', () => () => ({ public: { baseDomain: 'topiqu.com' } }))

const find = vi.fn()
const redirect = vi.fn()
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubGlobal('getRequestHost', () => 'custom.example.com')
  vi.stubGlobal('prisma', { clientSite: { findFirst: find }, domainRedirect: { findUnique: redirect } })
  vi.clearAllMocks()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('current host entitlement', () => {
  it('shares the lookup between hooks only within the same request', async () => {
    const site = { id: 'blog', domain: 'custom.example.com', domainVerified: true }
    find.mockResolvedValue(site)
    const event = { context: {} } as H3Event
    const [a, b] = await Promise.all([cachedTenantByHost(event), cachedTenantByHost(event)])
    expect(a).toEqual(site)
    expect(b).toEqual(site)
    expect(find).toHaveBeenCalledOnce()
  })
  it('does not serve a retired domain from a previous request cache', async () => {
    find
      .mockResolvedValueOnce({ id: 'blog', domain: 'custom.example.com', domainVerified: true })
      .mockResolvedValueOnce(null)
    expect(await cachedTenantByHost({ context: {} } as H3Event)).not.toBeNull()
    expect(await cachedTenantByHost({ context: {} } as H3Event)).toBeNull()
    expect(find).toHaveBeenCalledTimes(2)
  })
  it('resolves a newly restored managed fallback even if a former shared cache still contains null', async () => {
    vi.stubGlobal('getRequestHost', () => 'restored.topiqu.com')
    vi.stubGlobal('cached', vi.fn().mockResolvedValue(null))
    const site = { id: 'blog', domain: 'restored.topiqu.com', domainVerified: true }
    find.mockResolvedValueOnce(null).mockResolvedValueOnce(site)
    expect(await cachedTenantByHost({ context: {} } as H3Event)).toBeNull()
    expect(await cachedTenantByHost({ context: {} } as H3Event)).toEqual(site)
  })
  it('does not retain a redirect to a custom domain after the canonical host changes', async () => {
    redirect
      .mockResolvedValueOnce({ clientSite: { domain: 'custom.example.com', domainVerified: true } })
      .mockResolvedValueOnce({ clientSite: { domain: 'restored.topiqu.com', domainVerified: true } })
    expect(await domainRedirectTarget('old.topiqu.com')).toBe('custom.example.com')
    expect(await domainRedirectTarget('old.topiqu.com')).toBe('restored.topiqu.com')
  })
})

import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state, navigateTo } = vi.hoisted(() => ({
  state: {
    origin: 'https://journal.example.test',
    hostTenantId: 'own-tenant' as string | null,
    user: { role: 'admin', clientSiteId: 'own-tenant' } as { role: string; clientSiteId: string } | null,
    ownDomain: 'journal.example.test',
  },
  navigateTo: vi.fn((path: unknown) => path),
}))

vi.mock('#app', async (original) => ({
  ...(await original<object>()),
  callWithNuxt: (_app: unknown, callback: (...args: unknown[]) => unknown, args: unknown[]) => callback(...args),
}))
mockNuxtImport('useNuxtApp', () => () => ({}))
mockNuxtImport('useRequestURL', () => () => new URL(state.origin))
mockNuxtImport('useRuntimeConfig', () => () => ({ public: { baseDomain: 'topiqu.com' } }))
mockNuxtImport('useAuth', () => () => ({ data: { value: { user: state.user } } }))
mockNuxtImport('useClientSite', () => async () => (state.hostTenantId ? { id: state.hostTenantId } : null))
mockNuxtImport('useClientSiteStatus', () => async () => ({
  data: { value: { domainVerified: true, domain: state.ownDomain } },
}))
mockNuxtImport('navigateTo', () => navigateTo)

beforeEach(() => {
  state.origin = 'https://journal.example.test'
  state.hostTenantId = 'own-tenant'
  state.user = { role: 'admin', clientSiteId: 'own-tenant' }
  state.ownDomain = 'journal.example.test'
  navigateTo.mockClear()
})

const run = async () => {
  const { default: middleware } = await import('../../app/middleware/admin')
  return middleware({ fullPath: '/en/settings?tab=integrations' } as never, {} as never)
}

describe('administration on verified tenant hosts', () => {
  it('keeps an authenticated member on their custom domain', async () => {
    await run()
    expect(navigateTo).not.toHaveBeenCalled()
  })
  it('keeps central administration accessible without a tenant hostname', async () => {
    state.origin = 'https://app.topiqu.com'
    state.hostTenantId = null
    await run()
    expect(navigateTo).not.toHaveBeenCalled()
  })
  it.each(['reader', 'superadmin'])('rejects a host session without the local admin role: %s', async (role) => {
    state.user!.role = role
    await run()
    expect(navigateTo).toHaveBeenCalledWith('/')
  })
  it('rejects an anonymous visitor', async () => {
    state.user = null
    await run()
    expect(navigateTo).toHaveBeenCalledWith('/')
  })
  it('does not let another tenant use the custom host administration', async () => {
    state.hostTenantId = 'foreign-tenant'
    await run()
    expect(navigateTo).toHaveBeenCalledWith('https://app.topiqu.com/en/settings?tab=integrations', { external: true })
  })
})

// @vitest-environment nuxt
import { shallowRef } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowMount, flushPromises, enableAutoUnmount } from '@vue/test-utils'

import StartPage from '../../app/pages/start.vue'
import AuthPage from '../../app/pages/autorizace/index.vue'

const mocks = vi.hoisted(() => ({
  route: { query: {} as Record<string, string>, path: '/en/autorizace' },
  session: { value: { user: { id: 'old-user', role: 'admin', email: 'old@example.test', clientSiteId: 'old-blog' } } },
  intent: { value: {} as unknown },
  fetch: vi.fn(),
  getSession: vi.fn(),
  navigate: vi.fn(),
  toast: vi.fn(),
}))
mockNuxtImport('useRoute', () => () => mocks.route)
mockNuxtImport('useRequestURL', () => () => new URL('https://app.topiqu.com'))
mockNuxtImport('useAuth', () => () => ({ data: mocks.session, getSession: mocks.getSession }))
mockNuxtImport('useAgencyIntent', () => () => mocks.intent)
mockNuxtImport(
  'useLocalePath',
  () => () => (route: { name: string; query?: Record<string, string> }) =>
    `/en/${route.name}${route.query ? `?${new URLSearchParams(route.query)}` : ''}`,
)
mockNuxtImport('useToast', () => () => ({ add: mocks.toast }))
mockNuxtImport('useCookie', () => () => shallowRef(null))
mockNuxtImport('useI18n', () => () => ({ locale: shallowRef('en'), t: (key: string) => key }))
mockNuxtImport('$fetch', () => mocks.fetch)
mockNuxtImport('navigateTo', () => mocks.navigate)

const global = {
  mocks: { $t: (key: string) => key },
  stubs: {
    AuthForm: { template: '<div data-auth-form />' },
    TenantCreate: true,
    UButton: { template: '<button><slot /></button>' },
  },
}
enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.resetAllMocks()
  mocks.route.query = {}
  mocks.session.value = { user: { id: 'old-user', role: 'admin', email: 'old@example.test', clientSiteId: 'old-blog' } }
  mocks.intent.value = { blogs: 5 }
  mocks.getSession.mockResolvedValue(undefined)
  mocks.fetch.mockResolvedValue({ ok: true })
})

describe('registration account handoff', () => {
  it('redeems the new proof and resolves its workspace in a fresh app even if session refresh is unavailable', async () => {
    mocks.route.query = { created: 'true', token: 'synthetic-one-time-proof' }
    mocks.getSession.mockRejectedValue(new Error('Session refresh unavailable'))
    const wrapper = shallowMount(AuthPage, { global })
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    expect(wrapper.find('[data-auth-form]').exists()).toBe(false)
    await flushPromises()
    expect(mocks.fetch).toHaveBeenCalledWith('/api/auth/sign-in/token', {
      method: 'POST',
      body: { token: 'synthetic-one-time-proof' },
      retry: 0,
      timeout: 20_000,
    })
    expect(mocks.getSession).not.toHaveBeenCalled()
    expect(mocks.navigate).toHaveBeenCalledWith('/en/start', { external: true, replace: true })
    expect(window.location.search).toBe('')
    expect(mocks.intent.value).toBeNull()
  })

  it('shows manual sign-in if the proof fails instead of continuing as the old account', async () => {
    mocks.route.query = { created: 'true', token: 'expired-proof' }
    mocks.fetch.mockRejectedValueOnce(new Error('Expired'))
    const wrapper = shallowMount(AuthPage, { global })
    await flushPromises()
    expect(mocks.navigate).toHaveBeenCalledWith('/en/autorizace?created=true', { external: true, replace: true })
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.find('[data-auth-form]').exists()).toBe(true)
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
  })

  it('clears an earlier agency visit for a direct blog registration', () => {
    mocks.route.query = { mode: 'register' }
    shallowMount(AuthPage, { global })
    expect(mocks.intent.value).toBeNull()
  })

  it('shows recovery sign-in when the registration proof is already consumed or expired', () => {
    mocks.route.query = { created: 'true' }
    const wrapper = shallowMount(AuthPage, { global })
    expect(wrapper.find('[data-auth-form]').exists()).toBe(true)
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.navigate).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'UAlert' }).exists()).toBe(true)
  })
})

describe('workspace after registration', () => {
  it('opens the blog created by the landing instead of asking to create it again', async () => {
    mocks.session.value.user.clientSiteId = 'landing-blog'
    mocks.fetch.mockResolvedValue([{ clientSiteId: 'landing-blog' }])
    shallowMount(StartPage, { global })
    await flushPromises()
    expect(mocks.navigate).toHaveBeenCalledWith('/en/admin', { replace: true })
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it.each([null, { status: 'INACTIVE' }, { status: 'CANCELED' }])(
    'offers a normal blog without agency payment: %j',
    async (agency) => {
      mocks.fetch.mockResolvedValueOnce([]).mockResolvedValueOnce({ agency })
      const wrapper = shallowMount(StartPage, { global })
      await flushPromises()
      expect(mocks.navigate).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain('common.tenant.createAction')
    },
  )
})

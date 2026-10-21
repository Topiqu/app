// @vitest-environment nuxt
import { flushPromises } from '@vue/test-utils'
import { nextTick, reactive, shallowRef, type ShallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import type { ClientSiteStatus } from '../../app/composables/useClientSite'

import SetupChecklist from '../../app/components/Admin/SetupChecklist.vue'

type SetupSite = Pick<
  ClientSiteStatus,
  'id' | 'name' | 'description' | 'logoUrl' | 'plan' | 'domain' | 'domainVerified' | 'focus' | 'audience' | 'setup'
>
const mocks = vi.hoisted(() => ({
  auth: undefined as unknown as ShallowRef<{ user: { id: string; clientSiteId: string; scopes: string[] } }>,
  site: undefined as unknown as ShallowRef<SetupSite | null>,
  route: undefined as unknown as { name: string; path: string },
  refresh: vi.fn(),
}))
mockNuxtImport('useAuth', () => () => ({ data: mocks.auth }))
mockNuxtImport('useClientSiteStatus', () => () => ({
  data: mocks.site,
  error: shallowRef(null),
  refresh: mocks.refresh,
}))
mockNuxtImport('useTenantScope', () => () => (scope: string) => mocks.auth.value.user.scopes.includes(scope))
mockNuxtImport('useRoute', () => () => mocks.route)
mockNuxtImport(
  'useLocalePath',
  () => () => (route: string | { name: string; query?: { tab: string } }) =>
    typeof route === 'string' ? route : route.query ? `/settings?tab=${route.query.tab}` : `/${route.name}`,
)

const site = (id = 'site-a'): SetupSite => ({
  id,
  name: 'My blog',
  description: null,
  logoUrl: null,
  plan: 'PRO',
  domain: 'example.topiqu.com',
  domainVerified: true,
  focus: null,
  audience: null,
  setup: { hasPublishedArticle: false, knowledge: { indexed: 0, processing: 0, failed: 0 } },
})
const mounted: Array<{ unmount: () => void }> = []
const mount = async () => {
  const wrapper = await mountSuspended(SetupChecklist, {
    global: { mocks: { $t: (key: string) => key } },
    attachTo: document.body,
  })
  mounted.push(wrapper)
  return wrapper
}

beforeEach(() => {
  localStorage.clear()
  mocks.auth = shallowRef({
    user: {
      id: 'user-a',
      clientSiteId: 'site-a',
      scopes: ['TENANT_SETTINGS', 'AI_USE', 'ARTICLE_WRITE', 'ARTICLE_PUBLISH'],
    },
  })
  mocks.site = shallowRef(site())
  mocks.route = reactive({ name: 'admin___cs', path: '/cs/admin' })
})
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  localStorage.clear()
})

describe('dashboard setup checklist', () => {
  it('opens on the initial dashboard and remembers collapsing after a remount', async () => {
    const wrapper = await mount()
    expect(wrapper.get('[data-setup-toggle]').element.tagName).toBe('BUTTON')
    expect(wrapper.get('[data-setup-toggle]').attributes('aria-expanded')).toBe('true')
    await wrapper.get('[data-setup-toggle]').trigger('click')
    expect(wrapper.get('[data-setup-toggle]').attributes('aria-expanded')).toBe('false')
    await flushPromises()
    expect(localStorage.getItem('topiqu-setup-v1:user-a:site-a')).toBe('collapsed')
    wrapper.unmount()
    const restored = await mount()
    expect(restored.get('[data-setup-toggle]').attributes('aria-expanded')).toBe('false')
  }, 30_000)

  it('can be hidden and reopened from the layout action', async () => {
    const wrapper = await mount()
    const hide = wrapper.findAll('button').find((button) => button.text() === 'common.setup.hide')!
    await hide.trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-setup-checklist]').exists()).toBe(false)
    wrapper.vm.show()
    await nextTick()
    expect(wrapper.get('[data-setup-toggle]').attributes('aria-expanded')).toBe('true')
  })

  it('keeps preferences separate for each tenant and user and hides stale tenant data', async () => {
    const wrapper = await mount()
    await wrapper.get('[data-setup-toggle]').trigger('click')
    mocks.auth.value = { user: { ...mocks.auth.value.user, clientSiteId: 'site-b' } }
    await nextTick()
    expect(wrapper.find('[data-setup-checklist]').exists()).toBe(false)
    mocks.site.value = site('site-b')
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.get('[data-setup-toggle]').attributes('aria-expanded')).toBe('true'))
    mocks.auth.value = { user: { ...mocks.auth.value.user, clientSiteId: 'site-a' } }
    mocks.site.value = site()
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.get('[data-setup-toggle]').attributes('aria-expanded')).toBe('false'))
    mocks.auth.value = { user: { ...mocks.auth.value.user, id: 'user-b' } }
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.get('[data-setup-toggle]').attributes('aria-expanded')).toBe('true'))
  })

  it('collapses when navigating away and stays collapsed on returning to the dashboard', async () => {
    const wrapper = await mount()
    mocks.route.name = 'settings___cs'
    mocks.route.path = '/cs/settings'
    await nextTick()
    expect(wrapper.get('[data-setup-toggle]').attributes('aria-expanded')).toBe('false')
    mocks.route.name = 'admin___cs'
    mocks.route.path = '/cs/admin'
    await nextTick()
    expect(wrapper.get('[data-setup-toggle]').attributes('aria-expanded')).toBe('false')
  })

  it('adapts its steps to the plan and links directly to the missing settings', async () => {
    mocks.site.value = { ...site(), plan: 'BASIC' }
    const wrapper = await mount()
    expect(wrapper.findAll('[data-slot="item"]')).toHaveLength(2)
    expect(wrapper.get('a[href="/settings?tab=branding"]').exists()).toBe(true)
    mocks.site.value = { ...site(), description: 'Our blog' }
    await nextTick()
    expect(wrapper.findAll('[data-slot="item"]')).toHaveLength(3)
    expect(wrapper.get('a[href="/settings?tab=content"]').exists()).toBe(true)
  })

  it('reacts to server completion and keeps completed setup available on demand', async () => {
    const wrapper = await mount()
    mocks.site.value = {
      ...site(),
      description: 'Our blog',
      focus: 'Web design',
      audience: 'Small businesses',
      setup: { ...site().setup, hasPublishedArticle: true },
    }
    await nextTick()
    expect(wrapper.find('[data-setup-checklist]').exists()).toBe(false)
    wrapper.vm.show()
    await nextTick()
    expect(wrapper.text()).toContain('common.setup.completeTitle')
  })

  it('does not offer tenant setup to members without settings permission', async () => {
    mocks.auth.value.user.scopes = ['ARTICLE_WRITE']
    const wrapper = await mount()
    expect(wrapper.find('[data-setup-checklist]').exists()).toBe(false)
  })

  it('keeps knowledge recommendations separate from progress until sources finish indexing', async () => {
    mocks.site.value = { ...site(), setup: { ...site().setup, knowledge: { indexed: 0, processing: 1, failed: 0 } } }
    const wrapper = await mount()
    const recommended = wrapper.findAll('button').find((button) => button.text() === 'common.setup.recommended')!
    await recommended.trigger('click')
    expect(wrapper.text()).toContain('common.setup.recommendations.knowledge.processing')
    expect(wrapper.findAll('[data-slot="item"]')).toHaveLength(3)
    mocks.site.value = { ...site(), setup: { ...site().setup, knowledge: { indexed: 0, processing: 0, failed: 1 } } }
    await nextTick()
    expect(wrapper.text()).toContain('common.setup.recommendations.knowledge.failed')
    mocks.site.value = { ...site(), setup: { ...site().setup, knowledge: { indexed: 1, processing: 0, failed: 0 } } }
    await nextTick()
    expect(wrapper.text()).not.toContain('common.setup.recommendations.knowledge.title')
    expect(wrapper.findAll('[data-slot="item"]')).toHaveLength(3)
  })
})

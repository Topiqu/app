// @vitest-environment nuxt
import { shallowRef } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import AdminPage from '../../app/pages/admin/index.vue'
import UpgradeBanner from '../../app/components/Admin/UpgradeBanner.vue'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  refreshStatus: vi.fn(),
  toast: vi.fn(),
  status: { value: null as Record<string, unknown> | null },
}))
mockNuxtImport('$fetch', () => mocks.request)
mockNuxtImport('refreshClientSiteStatus', () => mocks.refreshStatus)
mockNuxtImport('useToast', () => () => ({ add: mocks.toast }))
mockNuxtImport('useTenantScope', () => () => () => true)
mockNuxtImport('useClientSiteStatus', () => () => ({ data: shallowRef(mocks.status.value) }))
mockNuxtImport('useAuth', () => () => ({ data: shallowRef({ user: { plan: 'BASIC' } }) }))
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))

const siteStatus = (state: string) => ({
  name: 'Demo',
  plan: 'BASIC',
  domainVerified: true,
  billingProvider: 'STRIPE',
  hasActiveSubscription: false,
  trial: { state, endsAt: null, daysLeft: 0, repeatInbox: false },
})

const TrialModalStub = {
  props: ['modelValue'],
  emits: ['continueFree'],
  template: '<div v-if="modelValue" data-trial-modal><button data-free @click="$emit(\'continueFree\')" /></div>',
}

const mounted: Array<{ unmount: () => void }> = []
const mountPage = async () => {
  const wrapper = await mountSuspended(AdminPage, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        ArticleTable: true,
        AdminUpgradeBanner: true,
        AdminDomainVerificationBanner: true,
        ModalTrialExpired: TrialModalStub,
      },
    },
  })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  clearNuxtState('trial-expired-prompted')
  document.cookie = 'upsell-dismissed=; max-age=0; path=/'
  mocks.status.value = siteStatus('EXPIRED')
})
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})

describe('expired trial prompt', () => {
  it('refreshes the cached status after "continue free" and closes', async () => {
    mocks.request.mockResolvedValue({ success: true })
    const wrapper = await mountPage()

    await wrapper.find('[data-free]').trigger('click')
    await flushPromises()

    expect(mocks.request).toHaveBeenCalledWith('/api/clients/end-trial', { method: 'POST' })
    expect(mocks.refreshStatus).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-trial-modal]').exists()).toBe(false)
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ color: 'success' }))
  })

  it('stays open and reports a failed request', async () => {
    mocks.request.mockRejectedValue(new Error('409'))
    const wrapper = await mountPage()

    await wrapper.find('[data-free]').trigger('click')
    await flushPromises()

    expect(mocks.refreshStatus).not.toHaveBeenCalled()
    expect(wrapper.find('[data-trial-modal]').exists()).toBe(true)
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
  })

  it('asks once per visit, not on every return to the page', async () => {
    const first = await mountPage()
    expect(first.find('[data-trial-modal]').exists()).toBe(true)
    first.unmount()

    const second = await mountPage()
    expect(second.find('[data-trial-modal]').exists()).toBe(false)
  })
})

describe('upgrade banner', () => {
  it('can be dismissed and remembers the dismissed plan', async () => {
    mocks.status.value = siteStatus('NONE')
    const wrapper = await mountSuspended(UpgradeBanner, { global: { mocks: { $t: (key: string) => key } } })
    mounted.push(wrapper)

    expect(wrapper.text()).toContain('admin.upgrade.toPro.description')
    await wrapper.find('[data-slot="close"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('admin.upgrade.toPro.description')
    expect(decodeURIComponent(document.cookie)).toContain('upsell-dismissed=["PRO"]')
  })
})

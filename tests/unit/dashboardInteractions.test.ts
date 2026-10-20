// @vitest-environment nuxt
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import Account from '../../app/components/User/Account.vue'
import TenantCreate from '../../app/components/TenantCreate.vue'

mockNuxtImport('useAuth', () => () => ({
  data: shallowRef({ user: { id: 'test-user', name: 'Mentorize', role: 'reader' } }),
  getSession: vi.fn(),
  signOut: vi.fn(),
}))
mockNuxtImport('useLazyFetch', () => () => ({ data: shallowRef(null), refresh: vi.fn() }))
mockNuxtImport('useLocalePath', () => () => () => '/profile')

const mounted: Array<{ unmount: () => void }> = []
const global = { mocks: { $t: (key: string) => key }, stubs: { UserPicture: true } }

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  vi.unstubAllGlobals()
})

describe('dashboard interactions', () => {
  it('toggles the account from the same trigger after loading its content', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockResolvedValue({
        id: 'test-user',
        username: 'Mentorize',
        email: 'test@example.invalid',
        role: 'reader',
        createdAt: '2026-10-01T00:00:00Z',
        likesCount: 0,
        dislikesCount: 0,
        commentsCount: 0,
      }),
    )
    const wrapper = await mountSuspended(Account, { global, attachTo: document.body })
    mounted.push(wrapper)
    const trigger = wrapper.get('button')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    await trigger.trigger('click')
    await flushPromises()
    expect(trigger.attributes('aria-expanded')).toBe('true')
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('false')
  })

  it('requires sequential progress and permits returning to completed steps', async () => {
    const wrapper = await mountSuspended(TenantCreate, {
      props: { modelValue: true },
      global: { ...global, stubs: { UModal: { template: '<div><slot name="body" /><slot name="footer" /></div>' } } },
    })
    mounted.push(wrapper)
    const steps = () => wrapper.findAll('ol button')
    expect(steps().map((step) => step.attributes('disabled') !== undefined)).toEqual([false, true, true, true])
    const next = () => wrapper.findAll('button').find((button) => button.text() === 'common.actions.continue')!
    await next().trigger('click')
    expect(steps()[1]!.attributes('aria-current')).toBe('step')
    expect(steps()[2]!.attributes('disabled')).toBeDefined()
    await steps()[0]!.trigger('click')
    expect(steps()[0]!.attributes('aria-current')).toBe('step')
    await steps()[1]!.trigger('click')
    expect(steps()[1]!.attributes('aria-current')).toBe('step')
    await next().trigger('click')
    expect(steps()[2]!.attributes('aria-current')).toBe('step')
    expect(next().attributes('disabled')).toBeDefined()
    expect(steps()[3]!.attributes('disabled')).toBeDefined()
  })
})

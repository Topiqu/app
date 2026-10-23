// @vitest-environment nuxt

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import { clearNuxtData, refreshNuxtData, useNuxtApp } from '#app'

import FollowDialog from '../../app/components/User/FollowDialog.vue'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
mockNuxtImport('useRequestFetch', () => () => mocks.fetch)
mockNuxtImport('useLocalePath', () => () => () => '/profile')
type FollowType = 'followers' | 'followed'
const mountProfiles = async (type: FollowType = 'followers') => {
  const wrapper = await mountSuspended(FollowDialog, {
    props: { type, modelValue: true },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        UModal: { template: '<div><slot name="body" /></div>' },
        UPageCard: { template: '<article><slot /></article>' },
        UProgress: true,
        UAlert: true,
        UEmpty: true,
        UserPicture: true,
      },
    },
  })
  await flushPromises()
  return wrapper
}
enableAutoUnmount(afterEach)
beforeEach(() => {
  clearNuxtData((key) => key.startsWith('follow-profiles:'))
  mocks.fetch.mockReset().mockImplementation((path: string) => Promise.resolve([{ id: path, username: path }]))
})
afterEach(() => {
  useNuxtApp().isHydrating = false
})

describe('full follow profile query ownership', () => {
  it('reuses SSR profile payload and keeps explicit refreshes fresh', async () => {
    const app = useNuxtApp()
    app.payload.data['follow-profiles:followers'] = [{ id: 'ssr-user', username: 'Server profile', bio: 'Full bio' }]
    app.payload.serverRendered = true
    app.isHydrating = true
    const wrapper = await mountProfiles()
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Server profile')
    expect(wrapper.text()).toContain('Full bio')
    app.isHydrating = false
    await refreshNuxtData('follow-profiles:followers')
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('/api/follows/followers')
  })

  it('switches follower/followed props and aborts active work when the dialog is unmounted', async () => {
    const wrapper = await mountProfiles()
    await wrapper.setProps({ type: 'followed' })
    await flushPromises()
    expect(wrapper.text()).toContain('/api/follows/followed')
    let resolve!: (rows: unknown[]) => void
    mocks.fetch.mockReturnValueOnce(
      new Promise((res) => {
        resolve = res
      }),
    )
    const refresh = refreshNuxtData('follow-profiles:followed')
    const signal = mocks.fetch.mock.lastCall?.[1].signal as AbortSignal
    wrapper.unmount()
    expect(signal.aborted).toBe(true)
    resolve([])
    await refresh
  })
})

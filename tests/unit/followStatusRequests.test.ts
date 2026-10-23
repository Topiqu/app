// @vitest-environment nuxt

import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import { clearNuxtData, useNuxtApp } from '#app'

import { useFollowStatus } from '../../app/composables/useFollowStatus'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
const auth = shallowRef<{ user: { id: string } } | null>({ user: { id: 'viewer' } })
mockNuxtImport('useAuth', () => () => ({ data: auth, signOut: vi.fn() }))
mockNuxtImport('useRequestFetch', () => () => mocks.fetch)
const deferred = () => {
  let resolve!: (rows: { id: string }[]) => void
  let reject!: (error: Error) => void
  const promise = new Promise<{ id: string }[]>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
const mountStatus = async (initial = 'author') => {
  const target = shallowRef(initial)
  let state!: ReturnType<typeof useFollowStatus>
  const component = defineComponent({
    setup() {
      state = useFollowStatus(target)
      return () => h('span', String(state.isFollowing.value))
    },
  })
  const wrapper = await mountSuspended(component)
  await flushPromises()
  return { wrapper, state, target }
}
enableAutoUnmount(afterEach)
beforeEach(() => {
  clearNuxtData((key) => key.startsWith('follow-status:'))
  mocks.fetch.mockReset().mockResolvedValue([{ id: 'author' }])
  auth.value = { user: { id: 'viewer' } }
})
afterEach(() => {
  useNuxtApp().isHydrating = false
})

describe('author follow status loading', () => {
  it('requests only the target author and exposes a known state after the response', async () => {
    const { state } = await mountStatus()
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('/api/follows/followed', {
      query: { followedId: 'author' },
      signal: expect.any(AbortSignal),
    })
    expect(state.known.value).toBe(true)
    expect(state.isFollowing.value).toBe(true)
    expect(state.pending.value).toBe(false)
  })

  it('reuses the SSR boolean payload and explicitly refreshes it during hydration', async () => {
    const app = useNuxtApp()
    app.payload.data['follow-status:viewer:author'] = { owner: 'viewer', followedId: 'author', following: true }
    app.payload.serverRendered = true
    app.isHydrating = true
    const { state } = await mountStatus()
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(state.known.value).toBe(true)
    mocks.fetch.mockResolvedValueOnce([])
    await state.refresh()
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(state.isFollowing.value).toBe(false)
  })

  it('does not request for a guest or missing target and starts after login', async () => {
    auth.value = null
    const { state, target } = await mountStatus('')
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(state.pending.value).toBe(false)
    auth.value = { user: { id: 'viewer' } }
    await nextTick()
    expect(mocks.fetch).not.toHaveBeenCalled()
    target.value = 'author'
    await flushPromises()
    expect(state.known.value).toBe(true)
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it.each(['success', 'failure'])('ignores stale %s after the author changes', async (outcome) => {
    const { state, target } = await mountStatus()
    const old = deferred()
    mocks.fetch.mockReturnValueOnce(old.promise)
    target.value = 'old-author'
    await nextTick()
    mocks.fetch.mockResolvedValueOnce([])
    target.value = 'new-author'
    await flushPromises()
    if (outcome === 'success') old.resolve([{ id: 'old-author' }])
    else old.reject(new Error('Old request failed'))
    await flushPromises()
    expect(state.isFollowing.value).toBe(false)
    expect(state.known.value).toBe(true)
    expect(state.error.value).toBeFalsy()
    expect(mocks.fetch.mock.calls[1]?.[1].signal.aborted).toBe(true)
  })

  it('never reuses a previous viewer’s positive follow state after identity changes', async () => {
    const { state } = await mountStatus()
    const pending = deferred()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    auth.value = { user: { id: 'new-viewer' } }
    expect(state.known.value).toBe(false)
    expect(state.isFollowing.value).toBe(false)
    await nextTick()
    pending.resolve([])
    await flushPromises()
    expect(state.known.value).toBe(true)
    expect(state.isFollowing.value).toBe(false)
  })

  it('retains unknown state on failure and becomes known after explicit retry', async () => {
    mocks.fetch.mockRejectedValueOnce(new Error('Offline'))
    const { state } = await mountStatus()
    expect(state.known.value).toBe(false)
    expect(state.pending.value).toBe(false)
    expect(state.error.value).toBeTruthy()
    await state.refresh()
    expect(state.known.value).toBe(true)
    expect(state.isFollowing.value).toBe(true)
  })

  it('keeps the last matching state visible during refresh without treating it as confirmed', async () => {
    const { state } = await mountStatus()
    const pending = deferred()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    const refresh = state.refresh()
    expect(state.isFollowing.value).toBe(true)
    expect(state.known.value).toBe(false)
    expect(state.pending.value).toBe(true)
    pending.resolve([])
    await refresh
    expect(state.isFollowing.value).toBe(false)
    expect(state.known.value).toBe(true)
  })

  it('aborts an outstanding read on unmount', async () => {
    const { state, wrapper } = await mountStatus()
    const pending = deferred()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    const refresh = state.refresh()
    wrapper.unmount()
    pending.resolve([])
    await refresh
    expect(mocks.fetch.mock.calls[1]?.[1].signal.aborted).toBe(true)
  })
})

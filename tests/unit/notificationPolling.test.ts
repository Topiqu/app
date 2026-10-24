// @vitest-environment nuxt

import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import { useNotificationPolling } from '../../app/composables/useNotificationPolling'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), session: vi.fn(), receive: vi.fn(), reset: vi.fn() }))
const auth = shallowRef<{ user: { id: string } } | null>({ user: { id: 'viewer' } })
const visibility = shallowRef('visible')
mockNuxtImport('$fetch', () => mocks.fetch)
mockNuxtImport('useAuth', () => () => ({ data: auth, getSession: mocks.session }))
mockNuxtImport('useDocumentVisibility', () => () => visibility)

const initialCursor = { createdAt: '2026-10-24T10:00:00.000Z', id: '' }
const response = (overrides = {}) => ({
  notifications: [],
  unreadCount: 0,
  cursor: initialCursor,
  hasMore: false,
  ...overrides,
})
const deferred = () => {
  let resolve!: (value: ReturnType<typeof response>) => void
  const promise = new Promise<ReturnType<typeof response>>((res) => {
    resolve = res
  })
  return { promise, resolve }
}
const mountPolling = async () => {
  let state!: ReturnType<typeof useNotificationPolling>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        state = useNotificationPolling({
          initialCursor: () => initialCursor,
          receive: mocks.receive,
          reset: mocks.reset,
        })
        return () => h('span', state.status.value)
      },
    }),
  )
  return { wrapper, state }
}

enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.useFakeTimers()
  mocks.fetch.mockReset().mockResolvedValue(response())
  mocks.session.mockReset().mockResolvedValue({ user: { id: 'viewer' } })
  mocks.receive.mockClear()
  mocks.reset.mockClear()
  auth.value = { user: { id: 'viewer' } }
  visibility.value = 'visible'
})
afterEach(() => vi.useRealTimers())

describe('notification polling recovery', () => {
  it('uses the server cursor even for an empty list and reports active only after success', async () => {
    const { state } = await mountPolling()
    expect(state.status.value).toBe('connecting')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(mocks.fetch).toHaveBeenCalledWith(
      '/api/notifications/poll',
      expect.objectContaining({
        query: { since: initialCursor.createdAt, sinceId: '' },
        retry: 0,
        signal: expect.any(AbortSignal),
      }),
    )
    expect(state.status.value).toBe('active')
  })

  it('stops on 403 until the user explicitly retries, without refreshing the session', async () => {
    mocks.fetch.mockRejectedValueOnce({ statusCode: 403 })
    const { state } = await mountPolling()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(mocks.fetch).toHaveBeenCalledOnce()
    expect(mocks.session).not.toHaveBeenCalled()
    expect(state.status.value).toBe('forbidden')
    state.retry()
    await flushPromises()
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(state.status.value).toBe('active')
  })

  it('refreshes a session once and stops if the retried request is still unauthorized', async () => {
    mocks.fetch.mockRejectedValue({ statusCode: 401 })
    const { state } = await mountPolling()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(mocks.session).toHaveBeenCalledExactlyOnceWith({ throwOnError: true })
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(state.status.value).toBe('unauthorized')
  })

  it('backs off transient failures and respects Retry-After', async () => {
    mocks.fetch.mockRejectedValueOnce({
      statusCode: 429,
      response: { status: 429, headers: new Headers({ 'retry-after': '90' }) },
    })
    const { state } = await mountPolling()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(state.status.value).toBe('retrying')
    await vi.advanceTimersByTimeAsync(89_999)
    expect(mocks.fetch).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1)
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(state.status.value).toBe('active')
  })

  it('preserves the signed-in user when the session check has a network failure', async () => {
    mocks.fetch.mockRejectedValueOnce({ statusCode: 401 })
    mocks.session.mockRejectedValueOnce(new Error('Offline'))
    const { state } = await mountPolling()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(auth.value?.user.id).toBe('viewer')
    expect(state.status.value).toBe('retrying')
    await vi.advanceTimersByTimeAsync(20_000)
    expect(state.status.value).toBe('active')
  })

  it('does not bypass a server retry delay by switching browser tabs', async () => {
    mocks.fetch.mockRejectedValueOnce({
      statusCode: 429,
      response: { status: 429, headers: new Headers({ 'retry-after': '90' }) },
    })
    await mountPolling()
    await vi.advanceTimersByTimeAsync(10_000)
    visibility.value = 'hidden'
    await nextTick()
    await vi.advanceTimersByTimeAsync(10_000)
    visibility.value = 'visible'
    await nextTick()
    expect(mocks.fetch).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(80_000)
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
  })

  it('waits for an in-flight poll and cancels it on unmount', async () => {
    const pending = deferred()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    const { wrapper } = await mountPolling()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(mocks.fetch).toHaveBeenCalledOnce()
    const signal = mocks.fetch.mock.calls[0]![1].signal as AbortSignal
    wrapper.unmount()
    expect(signal.aborted).toBe(true)
    pending.resolve(response())
    await flushPromises()
    expect(mocks.receive).not.toHaveBeenCalled()
  })

  it('discards the previous user response and resets the cursor on account changes', async () => {
    const pending = deferred()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    await mountPolling()
    await vi.advanceTimersByTimeAsync(10_000)
    const signal = mocks.fetch.mock.calls[0]![1].signal as AbortSignal
    auth.value = { user: { id: 'other-viewer' } }
    await nextTick()
    expect(signal.aborted).toBe(true)
    pending.resolve(response({ notifications: [{ id: 'private-old-notification' }] }))
    await flushPromises()
    expect(mocks.receive).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(mocks.receive).toHaveBeenCalledOnce()
  })

  it('pauses hidden documents and checks immediately when they become visible', async () => {
    const { state } = await mountPolling()
    visibility.value = 'hidden'
    await nextTick()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(state.status.value).toBe('paused')
    visibility.value = 'visible'
    await flushPromises()
    expect(mocks.fetch).toHaveBeenCalledOnce()
  })

  it('drains additional batches using the returned cursor without waiting ten seconds', async () => {
    const next = { createdAt: initialCursor.createdAt, id: 'notification-25' }
    mocks.fetch.mockResolvedValueOnce(response({ cursor: next, hasMore: true }))
    await mountPolling()
    await vi.advanceTimersByTimeAsync(10_250)
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(mocks.fetch.mock.calls[1]![1].query).toEqual({ since: next.createdAt, sinceId: next.id })
  })
})

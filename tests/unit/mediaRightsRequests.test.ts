// @vitest-environment nuxt

import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { computed, defineComponent, h, nextTick, shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'

import type { ArticleMediaInput, MediaRightsReport } from '../../shared/types/mediaRights'

import { useMediaRights } from '../../app/composables/useMediaRights'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
mockNuxtImport('$fetch', () => mocks.fetch)

const deferred = () => {
  let resolve!: (report: MediaRightsReport) => void
  let reject!: (error: Error) => void
  const promise = new Promise<MediaRightsReport>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const report = (fingerprint: string): MediaRightsReport => ({
  fingerprint,
  items: [],
  counts: { total: 0, recorded: 0, needsAttention: 0 },
})

const setup = () => {
  const input = shallowRef<ArticleMediaInput>({ content: 'Initial content' })
  let rights!: ReturnType<typeof useMediaRights>
  const wrapper = mount(
    defineComponent({
      setup() {
        rights = useMediaRights(computed(() => input.value))
        return () => h('div', rights.state.value)
      },
    }),
  )
  return { wrapper, input, rights }
}

enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.useFakeTimers()
  mocks.fetch.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('media rights request ownership', () => {
  it('invalidates the previous response as soon as content changes, before the debounce expires', async () => {
    const first = deferred()
    const second = deferred()
    mocks.fetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { input, rights } = setup()

    input.value = { content: 'Latest content' }
    await nextTick()
    first.resolve(report('old'))
    await flushPromises()
    expect(rights.result.value).toBeNull()
    expect(rights.state.value).toBe('loading')

    await vi.advanceTimersByTimeAsync(500)
    expect(mocks.fetch.mock.calls[1]?.[1].body).toEqual({ content: 'Latest content' })
    second.resolve(report('new'))
    await flushPromises()
    expect(rights.result.value?.fingerprint).toBe('new')
    expect(rights.state.value).toBe('complete')
  })

  it('keeps a newer successful result when an older request later fails', async () => {
    const first = deferred()
    const second = deferred()
    mocks.fetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { input, rights } = setup()

    input.value = { content: 'Changed content' }
    await nextTick()
    await vi.advanceTimersByTimeAsync(500)
    second.resolve(report('new'))
    await flushPromises()
    first.reject(new Error('Stale failure'))
    await flushPromises()

    expect(rights.result.value?.fingerprint).toBe('new')
    expect(rights.state.value).toBe('complete')
  })

  it('fences overlapping explicit refreshes even when the content has not changed', async () => {
    const first = deferred()
    const second = deferred()
    mocks.fetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { rights } = setup()

    const refresh = rights.refresh()
    second.resolve(report('refresh'))
    await refresh
    first.resolve(report('mount'))
    await flushPromises()

    expect(rights.result.value?.fingerprint).toBe('refresh')
    expect(rights.state.value).toBe('complete')
    expect(mocks.fetch.mock.calls[0]?.[1].signal.aborted).toBe(true)
  })

  it('cancels a queued debounce when an explicit refresh already checks the latest content', async () => {
    mocks.fetch.mockResolvedValue(report('current'))
    const { input, rights } = setup()
    await flushPromises()
    input.value = { content: 'Changed content' }
    await nextTick()

    await rights.refresh()
    await vi.advanceTimersByTimeAsync(500)

    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(rights.result.value?.fingerprint).toBe('current')
  })

  it('aborts active work, cancels scheduled work and ignores completion after disposal', async () => {
    const pending = deferred()
    mocks.fetch.mockReturnValue(pending.promise)
    const { input, wrapper, rights } = setup()
    input.value = { content: 'Changed content' }
    await nextTick()
    wrapper.unmount()

    pending.resolve(report('unmounted'))
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1000)

    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(mocks.fetch.mock.calls[0]?.[1].signal.aborted).toBe(true)
    expect(rights.result.value).toBeNull()
  })
})

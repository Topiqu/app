// @vitest-environment nuxt

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearNuxtData, useNuxtApp } from '#app'

import * as asyncDataRequest from '../../app/utils/asyncDataRequest'
import { useArticleFeed } from '../../app/composables/useArticleFeed'
import { emptyAsyncDataList } from '../../app/utils/asyncDataDefaults'

type Item = { id: string; title: string }
const fetch = vi.fn<(key: string, query: string, signal: AbortSignal) => Promise<Item[]>>()
const deferred = () => {
  let resolve!: (items: Item[]) => void
  const promise = new Promise<Item[]>((res) => {
    resolve = res
  })
  return { promise, resolve }
}
const mountFeed = async (lazy = false) => {
  const key = shallowRef('feed:first')
  const query = shallowRef('')
  let state!: Awaited<ReturnType<typeof useArticleFeed<Item[]>>>
  const wrapper = await mountSuspended(
    defineComponent({
      async setup() {
        state = await useArticleFeed(key, (signal) => fetch(key.value, query.value, signal), {
          default: emptyAsyncDataList,
          lazy,
        })
        return () => h('div', { 'data-status': state.status.value }, JSON.stringify(state.data.value))
      },
    }),
  )
  return { wrapper, state, key, query }
}
enableAutoUnmount(afterEach)
beforeEach(() => {
  clearNuxtData((key) => key.startsWith('feed:'))
  const app = useNuxtApp()
  Object.keys(app.static.data)
    .filter((key) => key.startsWith('feed:'))
    .forEach((key) => {
      Reflect.deleteProperty(app.static.data, key)
    })
  fetch.mockReset().mockResolvedValue([{ id: 'first', title: 'First' }])
})
afterEach(() => {
  useNuxtApp().isHydrating = false
  vi.restoreAllMocks()
})

describe('page-owned article feed requests', () => {
  it('reuses SSR payload and static data only on initial load, while an explicit filter refresh fetches fresh data', async () => {
    const app = useNuxtApp()
    app.payload.data['feed:first'] = [{ id: 'ssr', title: 'SSR article' }]
    app.static.data['feed:first'] = [{ id: 'stale', title: 'Static article' }]
    app.payload.serverRendered = true
    app.isHydrating = true
    const { wrapper, state, query } = await mountFeed()
    expect(wrapper.text()).toContain('SSR article')
    expect(fetch).not.toHaveBeenCalled()
    app.isHydrating = false
    query.value = 'new filter'
    await state.refresh()
    expect(fetch).toHaveBeenCalledExactlyOnceWith('feed:first', 'new filter', expect.any(AbortSignal))
    expect(wrapper.text()).toContain('First')
  })

  it('cancels stale key reads and never lets their late result replace the next article', async () => {
    const { wrapper, key } = await mountFeed()
    const old = deferred()
    fetch.mockReturnValueOnce(old.promise)
    key.value = 'feed:old-site:en'
    await nextTick()
    const signal = fetch.mock.lastCall?.[2] as AbortSignal
    fetch.mockResolvedValueOnce([{ id: 'new', title: 'New site article' }])
    key.value = 'feed:new-site:cs'
    await flushPromises()
    expect(signal.aborted).toBe(true)
    old.resolve([{ id: 'old', title: 'Old site article' }])
    await flushPromises()
    expect(wrapper.text()).toContain('New site article')
    expect(wrapper.text()).not.toContain('Old site article')
  })

  it('renders the lazy page before the response, aborts on unmount and drops its retained callback', async () => {
    const factory = vi.spyOn(asyncDataRequest, 'createAsyncDataRequest')
    const pending = deferred()
    fetch.mockReturnValue(pending.promise)
    const { wrapper } = await mountFeed(true)
    expect(wrapper.text()).toBe('[]')
    expect(wrapper.attributes('data-status')).toBe('pending')
    const signal = fetch.mock.lastCall?.[2] as AbortSignal
    wrapper.unmount()
    expect(signal.aborted).toBe(true)
    await expect(factory.mock.results[0]!.value.fetch(useNuxtApp(), { signal })).rejects.toMatchObject({
      name: 'AbortError',
    })
    pending.resolve([])
    await flushPromises()
  })
})

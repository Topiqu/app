import { createPinia, disposePinia } from 'pinia'
import { renderToString } from 'vue/server-renderer'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { PiniaColada, useQuery, useQueryCache } from '@pinia/colada'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createSSRApp, defineComponent, h, inject, shallowRef } from 'vue'

import { queryKeys } from '../../app/utils/queryKeys'
import { useTagQueries } from '../../app/composables/useTagQueries'

const { requestKey } = vi.hoisted(() => ({ requestKey: Symbol('request-fetch') }))
mockNuxtImport('useRequestFetch', () => () => inject(requestKey))
const piniaInstances: ReturnType<typeof createPinia>[] = []
const deferred = () => {
  let resolve!: (value: { id: string; name: string }[]) => void
  const promise = new Promise<{ id: string; name: string }[]>((res) => {
    resolve = res
  })
  return { promise, resolve }
}
const setup = (
  fetch = vi
    .fn<(path: string, options: { signal: AbortSignal }) => Promise<unknown[]>>()
    .mockResolvedValue([{ id: 'one', name: 'First' }]),
) => {
  const article = shallowRef<{ id: string } | undefined>({ id: 'article-one' })
  const initialTags = shallowRef<string[] | undefined>([])
  const queries: ReturnType<typeof useTagQueries>[] = []
  const pinia = createPinia()
  piniaInstances.push(pinia)
  const Consumer = defineComponent({
    setup() {
      const query = useTagQueries(article, initialTags)
      queries.push(query)
      return () => h('div', JSON.stringify({ tags: query.allTags.data.value, article: query.articleTags.data.value }))
    },
  })
  return { article, initialTags, queries, pinia, Consumer, fetch }
}
const mountConsumer = (state: ReturnType<typeof setup>) =>
  mount(state.Consumer, {
    global: { plugins: [state.pinia, PiniaColada], provide: { [requestKey]: state.fetch } },
  })
enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.stubGlobal('useQuery', useQuery)
  vi.stubGlobal('queryKeys', queryKeys)
})
afterEach(() => {
  piniaInstances.splice(0).forEach((pinia) => {
    const cache = useQueryCache(pinia)
    cache.getEntries().forEach((entry) => cache.remove(entry))
    disposePinia(pinia)
  })
  vi.unstubAllGlobals()
})

describe('tag query ownership', () => {
  it('deduplicates mounted consumers and keeps invalidation usable after one unmounts', async () => {
    const state = setup()
    const first = mountConsumer(state)
    const second = mountConsumer(state)
    await flushPromises()
    expect(state.fetch).toHaveBeenCalledTimes(1)
    expect(state.fetch).toHaveBeenCalledWith('/api/tags', { signal: expect.any(AbortSignal) })
    first.unmount()
    state.fetch.mockResolvedValueOnce([{ id: 'two', name: 'Updated' }])
    await useQueryCache(state.pinia).invalidateQueries({ key: queryKeys.tags.all })
    expect(second.text()).toContain('Updated')
    expect(state.fetch).toHaveBeenCalledTimes(2)
    expect(state.queries[1]!.articleTags.data.value).toEqual([])
  })

  it('aborts a shared pending read only when its last consumer unmounts', async () => {
    const pending = deferred()
    const state = setup(vi.fn(() => pending.promise))
    const first = mountConsumer(state)
    const second = mountConsumer(state)
    await flushPromises()
    const signal = state.fetch.mock.calls[0]![1]!.signal as AbortSignal
    first.unmount()
    expect(signal.aborted).toBe(false)
    second.unmount()
    expect(signal.aborted).toBe(true)
    pending.resolve([])
    await flushPromises()
  })

  it('keeps draft-owned tags local and switches article queries when props change', async () => {
    const state = setup(
      vi.fn(async (path: string) =>
        path === '/api/tags' ? [{ id: 'one', name: 'First' }] : [{ tagId: path, tag: { id: path, name: path } }],
      ),
    )
    const wrapper = mountConsumer(state)
    await flushPromises()
    expect(state.fetch).toHaveBeenCalledTimes(1)
    state.initialTags.value = undefined
    await flushPromises()
    expect(wrapper.text()).toContain('/api/articles/article-one/tags')
    state.article.value = { id: 'article-two' }
    await flushPromises()
    expect(wrapper.text()).toContain('/api/articles/article-two/tags')
    expect(wrapper.text()).not.toContain('/api/articles/article-one/tags')
    state.initialTags.value = ['one']
    await flushPromises()
    await useQueryCache(state.pinia).invalidateQueries({ key: queryKeys.articles.all })
    expect(state.fetch).toHaveBeenCalledTimes(3)
  })

  it('keeps cached article requests tied to their original IDs after the component changes article', async () => {
    const state = setup()
    state.initialTags.value = undefined
    mountConsumer(state)
    await flushPromises()
    state.article.value = { id: 'article-two' }
    await flushPromises()
    state.fetch.mockClear()
    await useQueryCache(state.pinia).invalidateQueries({ key: queryKeys.articles.all }, 'all')
    expect(state.fetch.mock.calls.map(([path]) => path).sort()).toEqual([
      '/api/articles/article-one/tags',
      '/api/articles/article-two/tags',
    ])
  })

  it('forwards the request-scoped fetch during SSR without sharing sessions between requests', async () => {
    const render = async (session: string) => {
      const state = setup(vi.fn(async () => [{ id: session, name: session }]))
      const app = createSSRApp(state.Consumer)
      app.use(state.pinia).use(PiniaColada)
      app.provide(requestKey, state.fetch)
      return { state, html: await renderToString(app) }
    }
    const first = await render('first-session')
    const second = await render('second-session')
    expect(first.html).toContain('first-session')
    expect(second.html).toContain('second-session')
    expect(second.html).not.toContain('first-session')
    await first.state.queries[0]!.allTags.refetch(true)
    expect(first.state.queries[0]!.allTags.data.value?.[0]?.id).toBe('first-session')
  })
})

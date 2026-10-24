// @vitest-environment nuxt

import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import type { ArticleWithDetails } from '../../types/article'

import Table from '../../app/components/Article/Table.vue'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  toast: vi.fn(),
  invalidate: vi.fn(),
  saved: vi.fn(),
  reverted: vi.fn(),
  setCache: vi.fn(),
}))
const articles = shallowRef<{ data: ArticleWithDetails[]; total: number }>({ data: [], total: 0 })
mockNuxtImport('$fetch', () => mocks.fetch)
mockNuxtImport('useToast', () => () => ({ add: mocks.toast }))
mockNuxtImport('useConfirm', () => () => vi.fn())
mockNuxtImport('useRoute', () => () => ({ query: {} }))
mockNuxtImport('useLocalePath', () => () => () => '/article')
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))
mockNuxtImport('useClientSiteStatus', () => async () => ({ data: shallowRef({ language: 'en' }) }))
mockNuxtImport('useTime', () => () => ({ formatTime: () => '' }))
mockNuxtImport('useCacheInvalidation', () => () => ({
  invalidateArticleLists: mocks.invalidate,
  invalidateArticlesAndStats: vi.fn(),
}))
mockNuxtImport('useQuery', () => () => ({
  data: articles,
  isPending: shallowRef(false),
  error: shallowRef(null),
  refetch: vi.fn(),
}))
mockNuxtImport('useQueryCache', () => () => ({
  getQueryData: () => articles.value,
  setQueryData: (key: unknown, value: typeof articles.value) => {
    mocks.setCache(key, value)
    articles.value = value
  },
}))
mockNuxtImport('useMutation', () => () => ({ mutate: vi.fn(), isLoading: shallowRef(false) }))
mockNuxtImport('useOptimisticStatus', () => () => ({ saving: () => 1, saved: mocks.saved, reverted: mocks.reverted }))
mockNuxtImport('useExport', () => () => ({ exportJson: vi.fn(), exportCsv: vi.fn(), exportPdf: vi.fn() }))

const TranslationMenu = defineComponent({
  name: 'ArticleTranslationMenuHarness',
  props: ['translating', 'translations'],
  emits: ['translate'],
  setup: () => () => h('span'),
})
const StatusCell = defineComponent({
  name: 'ArticleStatusCellHarness',
  props: ['row', 'pending'],
  emits: ['update'],
  setup: () => () => h('span'),
})
const Rows = defineComponent({
  props: ['data'],
  setup:
    (props, { slots }) =>
    () =>
      h(
        'div',
        props.data.map((article: ArticleWithDetails) => [
          slots['languages-cell']?.({ row: { original: article } }),
          slots['status-cell']?.({ row: { original: article } }),
        ]),
      ),
})
const mountTable = () =>
  mountSuspended(Table, {
    shallow: true,
    global: {
      mocks: { $t: (key: string) => key },
      renderStubDefaultSlot: true,
      stubs: { UTable: Rows, ArticleTranslationMenu: TranslationMenu, ArticleStatusCell: StatusCell },
    },
  })
const article = (translations: ArticleWithDetails['translations'] = []): ArticleWithDetails =>
  ({
    id: 'article-a',
    title: 'Article A',
    slug: 'article-a',
    status: 'draft',
    language: 'en',
    translations,
  }) as ArticleWithDetails
const deferred = () => {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetch.mockResolvedValue(undefined)
  mocks.invalidate.mockResolvedValue(undefined)
  articles.value = { data: [article()], total: 1 }
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('article table request intent', () => {
  it('replaces an existing translation only with its observed version', async () => {
    articles.value = {
      data: [
        article([{ language: 'cs', status: 'READY', slug: 'clanek', updatedAt: new Date('2026-10-22T09:00:00Z') }]),
      ],
      total: 1,
    }
    const wrapper = await mountTable()
    wrapper.findComponent(TranslationMenu).vm.$emit('translate', 'cs')
    await flushPromises()
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('/api/articles/article-a/translate', {
      method: 'POST',
      body: { language: 'cs', replace: true, expectedUpdatedAt: '2026-10-22T09:00:00.000Z', background: true },
    })
    expect(mocks.invalidate).toHaveBeenCalledTimes(1)
  })

  it('uses create-only intent for a missing translation', async () => {
    const wrapper = await mountTable()
    wrapper.findComponent(TranslationMenu).vm.$emit('translate', 'cs')
    await flushPromises()
    expect(mocks.fetch.mock.calls[0]?.[1].body).toEqual({
      language: 'cs',
      replace: false,
      expectedUpdatedAt: null,
      background: true,
    })
  })

  it('snapshots the target and version and blocks duplicate requests', async () => {
    const pending = deferred()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    articles.value = {
      data: [article([{ language: 'cs', status: 'READY', slug: null, updatedAt: '2026-10-22T09:00:00Z' }])],
      total: 1,
    }
    const wrapper = await mountTable()
    const menu = wrapper.findComponent(TranslationMenu)
    menu.vm.$emit('translate', 'cs')
    menu.vm.$emit('translate', 'de')
    articles.value.data[0]!.id = 'article-b'
    articles.value.data[0]!.translations![0]!.updatedAt = '2026-10-22T10:00:00Z'
    pending.resolve()
    await flushPromises()
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(mocks.fetch.mock.calls[0]?.[0]).toBe('/api/articles/article-a/translate')
    expect(mocks.fetch.mock.calls[0]?.[1].body.expectedUpdatedAt).toBe('2026-10-22T09:00:00.000Z')
  })

  it('invalidates committed translations after unmount without a stale toast', async () => {
    const pending = deferred()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    const wrapper = await mountTable()
    wrapper.findComponent(TranslationMenu).vm.$emit('translate', 'cs')
    wrapper.unmount()
    pending.resolve()
    await flushPromises()
    expect(mocks.invalidate).toHaveBeenCalledTimes(1)
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it('keeps an accepted background translation queued when list invalidation fails', async () => {
    mocks.invalidate.mockRejectedValueOnce(new Error('Cache unavailable'))
    const wrapper = await mountTable()
    wrapper.findComponent(TranslationMenu).vm.$emit('translate', 'cs')
    await flushPromises()
    expect(mocks.toast).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ color: 'info', title: 'articles.editor.translationStarted' }),
    )
    expect(console.warn).toHaveBeenCalledTimes(1)
    expect(wrapper.findComponent(TranslationMenu).props('translating')).toBe(false)
  })

  it('reports a translation conflict without invalidating or success', async () => {
    mocks.fetch.mockRejectedValueOnce(new Error('Conflict'))
    const wrapper = await mountTable()
    wrapper.findComponent(TranslationMenu).vm.$emit('translate', 'cs')
    await flushPromises()
    expect(mocks.invalidate).not.toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ color: 'error' }))
    expect(wrapper.findComponent(TranslationMenu).props('translating')).toBe(false)
  })

  it('sends status changes immediately and preserves the committed cached row when invalidation fails', async () => {
    mocks.invalidate.mockRejectedValueOnce(new Error('Cache unavailable'))
    const wrapper = await mountTable()
    wrapper.findComponent(StatusCell).vm.$emit('update', 'article-a', 'published')
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('/api/articles/article-a', {
      method: 'PATCH',
      body: { status: 'published' },
    })
    await flushPromises()
    expect(articles.value.data[0]?.status).toBe('published')
    expect(wrapper.findComponent(StatusCell).props('row').original.status).toBe('published')
    expect(mocks.setCache).toHaveBeenCalledTimes(1)
    expect(mocks.saved).toHaveBeenCalledWith(1)
    expect(mocks.reverted).not.toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ color: 'success' }))
  })

  it('restores a failed status change and allows another attempt', async () => {
    mocks.fetch.mockRejectedValueOnce(new Error('Offline'))
    const wrapper = await mountTable()
    wrapper.findComponent(StatusCell).vm.$emit('update', 'article-a', 'published')
    await flushPromises()
    expect(wrapper.findComponent(StatusCell).props('row').original.status).toBe('draft')
    expect(wrapper.findComponent(StatusCell).props('pending')).toBe(false)
    expect(mocks.reverted).toHaveBeenCalledWith(1)
    wrapper.findComponent(StatusCell).vm.$emit('update', 'article-a', 'archived')
    await flushPromises()
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(articles.value.data[0]?.status).toBe('archived')
  })

  it('cancels a queued filter URL update when the table unmounts', async () => {
    const wrapper = await mountTable()
    const replace = vi.spyOn(useNuxtApp().$router, 'replace')
    vi.useFakeTimers()
    wrapper.findComponent({ name: 'UInput' }).vm.$emit('update:modelValue', 'new search')
    await nextTick()
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(450)
    expect(replace).not.toHaveBeenCalled()
  })
})

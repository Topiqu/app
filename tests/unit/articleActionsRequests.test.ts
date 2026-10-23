// @vitest-environment nuxt

import { effectScope, shallowRef } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useArticleActions } from '../../app/composables/useArticleActions'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  share: vi.fn(),
  copy: vi.fn(),
  toast: vi.fn(),
  invalidate: vi.fn(),
  invalidateStats: vi.fn(),
  refresh: vi.fn(),
}))
const status = shallowRef<{ kind: string | null; sequence: number }>({ kind: null, sequence: 0 })
const announce = (kind: string, expectedSequence?: number) => {
  if (expectedSequence === undefined || status.value.sequence === expectedSequence)
    status.value = { kind, sequence: status.value.sequence + 1 }
  return status.value.sequence
}
mockNuxtImport('$fetch', () => mocks.fetch)
mockNuxtImport('useArticleShare', () => () => mocks.share)
mockNuxtImport('useClipboard', () => () => ({ copy: mocks.copy }))
mockNuxtImport('useToast', () => () => ({ add: mocks.toast }))
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))
mockNuxtImport('useCacheInvalidation', () => () => ({
  invalidateArticles: mocks.invalidate,
  invalidateArticlesAndStats: mocks.invalidateStats,
}))
mockNuxtImport('useOptimisticStatus', () => () => ({
  status,
  saving: () => announce('saving'),
  saved: (sequence?: number) => announce('saved', sequence),
  reverted: (sequence?: number) => announce('reverted', sequence),
}))

const scopes: ReturnType<typeof effectScope>[] = []
const article = (id = 'article-a') => ({ id, status: 'draft' as const, allowedComments: true, shared: 3 })
const setup = () => {
  const scope = effectScope()
  scopes.push(scope)
  const data = shallowRef<{
    id: string
    status: 'draft' | 'published' | 'archived'
    allowedComments: boolean
    shared: number
  }>(article())
  return { scope, data, ...scope.run(() => useArticleActions(data, mocks.refresh))! }
}
const deferred = <T = undefined>() => {
  let resolve!: (result: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.clearAllMocks()
  status.value = { kind: null, sequence: 0 }
  for (const mock of [mocks.fetch, mocks.copy, mocks.invalidate, mocks.invalidateStats, mocks.refresh])
    mock.mockResolvedValue(undefined)
  mocks.share.mockResolvedValue(4)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  vi.restoreAllMocks()
})

describe('article action request ownership', () => {
  it('never writes a previous article’s share count into the next article', async () => {
    const pending = deferred<number>()
    mocks.share.mockReturnValueOnce(pending.promise)
    const state = setup()
    const share = state.share('OTHER')
    state.data.value = { ...article('article-b'), shared: 10 }
    pending.resolve(4)
    await share
    expect(mocks.share).toHaveBeenCalledWith('article-a', 'OTHER')
    expect(state.data.value.shared).toBe(10)
  })

  it('ignores an earlier share response arriving after the latest response', async () => {
    const first = deferred<number>()
    const second = deferred<number>()
    mocks.share.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const state = setup()
    const old = state.share('OTHER')
    const latest = state.share('OTHER')
    second.resolve(5)
    await latest
    first.resolve(4)
    await old
    expect(state.data.value.shared).toBe(5)
  })

  it('keeps copy-link tracking tied to the article whose link was copied', async () => {
    const pending = deferred<undefined>()
    mocks.copy.mockReturnValueOnce(pending.promise)
    const state = setup()
    const copy = state.copyLink('https://example.com/article-a')
    state.data.value = article('article-b')
    pending.resolve(undefined)
    await copy
    expect(mocks.share).toHaveBeenCalledWith('article-a', 'OTHER')
    expect(state.data.value.shared).toBe(3)
  })

  it('reports clipboard failure without a false success or analytics request', async () => {
    mocks.copy.mockRejectedValueOnce(new Error('Clipboard denied'))
    await setup().copyLink('https://example.com/article-a')
    expect(mocks.share).not.toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledExactlyOnceWith({ color: 'error', title: 'common.messages.operationFailed' })
  })

  it('coalesces repeated comment toggles and restores the captured value on current failure', async () => {
    const pending = deferred<undefined>()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    const state = setup()
    const toggle = state.toggleComments()
    await state.toggleComments()
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(state.data.value.allowedComments).toBe(false)
    pending.reject(new Error('Offline'))
    await toggle
    expect(state.data.value.allowedComments).toBe(true)
    expect(status.value.kind).toBe('reverted')
  })

  it('does not roll back a different article when an old toggle fails', async () => {
    const pending = deferred<undefined>()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    const state = setup()
    const toggle = state.toggleComments()
    state.data.value = { ...article('article-b'), allowedComments: false }
    pending.reject(new Error('Old request failed'))
    await toggle
    expect(state.data.value.allowedComments).toBe(false)
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it('sends status intent immediately, keeps its target through disposal and invalidates the committed change', async () => {
    const pending = deferred<undefined>()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    const state = setup()
    const save = state.debouncedSetStatus('article-a', 'published')
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    state.scope.stop()
    state.data.value = article('article-b')
    pending.resolve(undefined)
    await save
    expect(mocks.fetch.mock.calls[0]![0]).toBe('/api/articles/article-a')
    expect(state.data.value.status).toBe('draft')
    expect(mocks.invalidateStats).toHaveBeenCalledTimes(1)
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it('retains a successful status change when cache or view refresh fails', async () => {
    mocks.invalidateStats.mockRejectedValueOnce(new Error('Cache unavailable'))
    mocks.refresh.mockRejectedValueOnce(new Error('Read unavailable'))
    const state = setup()
    await state.debouncedSetStatus('article-a', 'published')
    expect(state.data.value.status).toBe('published')
    expect(status.value.kind).toBe('saved')
    expect(mocks.toast).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ color: 'success' }))
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('does not let an older operation complete the status announcement of a newer operation', async () => {
    const first = deferred<undefined>()
    const second = deferred<undefined>()
    mocks.fetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const state = setup()
    const old = state.debouncedSetStatus('article-a', 'published')
    state.data.value = article('article-b')
    const latest = state.debouncedSetStatus('article-b', 'archived')
    first.resolve(undefined)
    await old
    expect(status.value.kind).toBe('saving')
    second.resolve(undefined)
    await latest
    expect(state.data.value.status).toBe('archived')
    expect(status.value.kind).toBe('saved')
  })

  it('ignores an event for another article and unsupported status values', async () => {
    const state = setup()
    await state.debouncedSetStatus('article-b', 'published')
    await state.debouncedSetStatus('article-a', 'unexpected')
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
})

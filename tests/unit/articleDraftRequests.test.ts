// @vitest-environment nuxt

import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { effectScope, nextTick, ref, shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ArticleWithDetails } from '../../types/article'
import type { ArticleDraft, Language } from '../../generated/zenstack/models'

import { useArticleDrafts } from '../../app/composables/useArticleDrafts'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), refresh: vi.fn(), toast: vi.fn() }))
const drafts = shallowRef<ArticleDraft[]>([])
mockNuxtImport('$fetch', () => mocks.fetch)
mockNuxtImport('useLazyFetch', () => () => ({ data: drafts, refresh: mocks.refresh, pending: shallowRef(false) }))
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))
mockNuxtImport('useToast', () => () => ({ add: mocks.toast }))

const draft = (id = 'draft-1') =>
  ({
    id,
    title: 'Saved draft',
    excerpt: '',
    content: '<p>Saved</p>',
    imageUrl: null,
    coverMediaId: null,
    language: 'en',
  }) as ArticleDraft
const scopes: ReturnType<typeof effectScope>[] = []
const setup = () => {
  const scope = effectScope()
  scopes.push(scope)
  const article = ref<ArticleWithDetails>({
    id: '',
    createdAt: '',
    title: 'Initial title',
    slug: 'initial-title',
    excerpt: '',
    content: '<p>Initial</p>',
    imageUrl: null,
    readingTime: null,
    views: 0,
    status: 'draft',
    releaseAt: null,
    aiInvolvement: 'NONE',
    savedAmount: 0,
    savedTimeMinutes: 0,
    user: null,
    tags: [],
    _count: null,
  })
  const idle = shallowRef(false)
  const paused = shallowRef(false)
  const language = shallowRef<Language>('en')
  const state = scope.run(() => useArticleDrafts(article, idle, { enabled: true, paused, language }))!
  return { article, paused, idle, language, scope, ...state }
}
const deferred = () => {
  let resolve!: (value: { draft: ArticleDraft }) => void
  let reject!: (error: Error) => void
  const promise = new Promise<{ draft: ArticleDraft }>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  drafts.value = []
  mocks.fetch.mockResolvedValue({ draft: draft() })
  mocks.refresh.mockResolvedValue(undefined)
})
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  vi.useRealTimers()
})

describe('article draft autosave ownership', () => {
  it('serializes every queued write instead of letting multiple waiters start together', async () => {
    const first = deferred()
    const second = deferred()
    const third = deferred()
    mocks.fetch
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockReturnValueOnce(third.promise)
    const state = setup()
    const saves = [state.saveDraftNow(), state.saveDraftNow(), state.saveDraftNow()]
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    first.resolve({ draft: draft() })
    await flushPromises()
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(mocks.fetch.mock.calls[1]![1].body.id).toBe('draft-1')
    second.resolve({ draft: draft() })
    await flushPromises()
    expect(mocks.fetch).toHaveBeenCalledTimes(3)
    third.resolve({ draft: draft() })
    expect(await Promise.all(saves)).toEqual([true, true, true])
  })

  it('does not overwrite the identity of a draft loaded during an earlier save', async () => {
    const first = deferred()
    mocks.fetch.mockReturnValueOnce(first.promise)
    const state = setup()
    const save = state.saveDraftNow()
    state.loadDraft(draft('different-draft'))
    first.resolve({ draft: draft('older-draft') })
    await save
    await state.saveDraftNow()
    expect(mocks.fetch.mock.lastCall![1].body).toMatchObject({ id: 'different-draft', title: 'Saved draft' })
  })

  it('cancels the debounce and its watcher when disposed, and refuses later explicit saves', async () => {
    const state = setup()
    state.article.value.title = 'Changed title'
    await nextTick()
    expect(vi.getTimerCount()).toBe(1)
    state.scope.stop()
    expect(vi.getTimerCount()).toBe(0)
    state.article.value.title = 'Changed after disposal'
    await nextTick()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await state.saveDraftNow()).toBe(false)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('allows an active recovery write to finish durably but drops queued work and UI effects after disposal', async () => {
    const first = deferred()
    mocks.fetch.mockReturnValueOnce(first.promise)
    const state = setup()
    const active = state.saveDraftNow()
    const queued = state.saveDraftNow()
    state.scope.stop()
    first.resolve({ draft: draft() })
    expect(await active).toBe(true)
    expect(await queued).toBe(false)
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(mocks.toast).not.toHaveBeenCalled()
    expect(state.lastSavedAt.value).toBeNull()
  })

  it('saves cover-media ownership changes and cancels a redundant debounce after an explicit save', async () => {
    const state = setup()
    state.article.value.coverMediaId = 'media-1'
    await nextTick()
    await vi.advanceTimersByTimeAsync(8000)
    expect(mocks.fetch.mock.lastCall![1].body.coverMediaId).toBe('media-1')
    state.article.value.coverMediaId = 'media-2'
    await nextTick()
    await state.saveDraftNow()
    await vi.advanceTimersByTimeAsync(8000)
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
  })

  it('keeps automatic writes paused during generation while allowing the explicit completion save', async () => {
    const state = setup()
    state.paused.value = true
    state.article.value.title = 'Generation output'
    await nextTick()
    await vi.advanceTimersByTimeAsync(8000)
    expect(mocks.fetch).not.toHaveBeenCalled()
    await state.saveDraftNow()
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })
})

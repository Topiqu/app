// @vitest-environment nuxt

import { effectScope, nextTick, shallowRef } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ArticleTranslationRow } from '../../shared/utils/articleTranslations'
import type { ArticleTranslationsPayload } from '../../app/composables/useArticleTranslations'

import { useArticleTranslations } from '../../app/composables/useArticleTranslations'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  refresh: vi.fn(),
  invalidate: vi.fn(),
  toast: vi.fn(),
  confirm: vi.fn(),
}))
const data = shallowRef<ArticleTranslationsPayload>({
  translations: [],
  targetLanguages: ['en', 'de', 'fr'],
  translationMode: 'MANUAL',
})
const status = shallowRef('success')
mockNuxtImport('$fetch', () => mocks.fetch)
mockNuxtImport('useFetch', () => () => ({ data, status, error: shallowRef(null), refresh: mocks.refresh }))
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))
mockNuxtImport('useToast', () => () => ({ add: mocks.toast }))
mockNuxtImport('useConfirm', () => () => mocks.confirm)
mockNuxtImport('useCacheInvalidation', () => () => ({ invalidateArticleLists: mocks.invalidate }))

const initialVersion = '2026-10-22T12:00:00.000Z'
const savedVersion = '2026-10-22T12:01:00.000Z'
const laterVersion = '2026-10-22T12:02:00.000Z'
const row = (language = 'en', values: Partial<ArticleTranslationRow> = {}): ArticleTranslationRow => ({
  id: `translation-${language}`,
  language,
  slug: language,
  title: `${language} title`,
  excerpt: `${language} excerpt`,
  content: `<p>${language} content</p>`,
  answer: null,
  keyTakeaways: [],
  faq: [],
  status: 'READY',
  source: 'AI',
  error: null,
  translatedAt: null,
  updatedAt: initialVersion,
  ...values,
})
const scopes: ReturnType<typeof effectScope>[] = []
const setup = (language = 'en', articleId: string | undefined = 'article-1') => {
  const scope = effectScope()
  scopes.push(scope)
  return { scope, ...scope.run(() => useArticleTranslations(articleId, language))! }
}
const deferred = () => {
  let resolve!: (value: { translation: ArticleTranslationRow }) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<{ translation: ArticleTranslationRow }>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetch.mockReset()
  status.value = 'success'
  data.value = { translations: [row(), row('de')], targetLanguages: ['en', 'de', 'fr'], translationMode: 'MANUAL' }
  mocks.refresh.mockResolvedValue(undefined)
  mocks.invalidate.mockResolvedValue(undefined)
  mocks.confirm.mockResolvedValue(false)
  mocks.fetch.mockResolvedValue({ translation: row('en', { updatedAt: savedVersion, source: 'HUMAN' }) })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  vi.restoreAllMocks()
})

describe('translation draft and request ownership', () => {
  it('preserves dirty content and the version that seeded it when the same language refreshes', async () => {
    const state = setup()
    state.draft.value.title = 'My unsaved title'
    data.value = {
      ...data.value,
      translations: [row('en', { title: 'Someone else’s title', updatedAt: savedVersion })],
    }
    await nextTick()
    expect(state.draft.value.title).toBe('My unsaved title')
    expect(state.isDirty.value).toBe(true)
    expect(state.conflict.value).toBe(true)
    await state.save()
    expect(mocks.fetch.mock.lastCall).toMatchObject([
      '/api/translations/translation-en',
      {
        method: 'PATCH',
        body: { title: 'My unsaved title', expectedUpdatedAt: initialVersion },
      },
    ])
  })

  it('accepts a clean refresh and uses its version for the next edit', async () => {
    const state = setup()
    data.value = { ...data.value, translations: [row('en', { title: 'Fresh title', updatedAt: savedVersion })] }
    await nextTick()
    expect(state.draft.value.title).toBe('Fresh title')
    state.draft.value.content = '<p>My next edit</p>'
    await state.save()
    expect(mocks.fetch.mock.lastCall![1].body.expectedUpdatedAt).toBe(savedVersion)
  })

  it('seeds the correct empty buffer when switching between missing languages', () => {
    const state = setup('fr')
    expect(state.draft.value).toEqual({ title: '', excerpt: '', content: '' })
    state.draft.value.title = 'Temporary missing-language buffer'
    data.value = { ...data.value, targetLanguages: ['en', 'de', 'fr', 'cs'] }
    state.activeLang.value = 'cs'
    expect(state.draft.value).toEqual({ title: '', excerpt: '', content: '' })
    expect(state.isDirty.value).toBe(false)
    state.activeLang.value = 'de'
    expect(state.draft.value.title).toBe('de title')
  })

  it('keeps edits made during a pending save and advances only the saved draft baseline', async () => {
    const pending = deferred()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    const state = setup()
    state.draft.value.title = 'Submitted title'
    const save = state.save()
    state.draft.value.title = 'Newer unsaved title'
    pending.resolve({ translation: row('en', { title: 'Submitted title', updatedAt: savedVersion }) })
    await save
    expect(state.draft.value.title).toBe('Newer unsaved title')
    expect(state.isDirty.value).toBe(true)
    expect(state.conflict.value).toBe(false)
    mocks.fetch.mockResolvedValueOnce({
      translation: row('en', { title: 'Newer unsaved title', updatedAt: laterVersion }),
    })
    await state.save()
    expect(mocks.fetch.mock.lastCall![1].body).toMatchObject({
      title: 'Newer unsaved title',
      expectedUpdatedAt: savedVersion,
    })
    expect(state.isDirty.value).toBe(false)
  })

  it('coalesces repeated saves in one language while allowing independent language requests', async () => {
    const first = deferred()
    const second = deferred()
    mocks.fetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const state = setup()
    state.draft.value.title = 'Saved English'
    const en = state.save()
    await state.save()
    state.activeLang.value = 'de'
    state.draft.value.title = 'Unsaved German'
    const de = state.save()
    first.resolve({ translation: row('en', { title: 'Saved English', updatedAt: savedVersion }) })
    await en
    expect(state.pending.value).toBe('save')
    expect(state.draft.value.title).toBe('Unsaved German')
    expect(mocks.toast).not.toHaveBeenCalled()
    second.resolve({ translation: row('de', { title: 'Unsaved German', updatedAt: savedVersion }) })
    await de
    expect(state.pending.value).toBeNull()
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(mocks.toast).toHaveBeenCalledTimes(1)
  })

  it.each(['success', 'conflict', 'failure'] as const)('fences stale %s after switching language', async (outcome) => {
    const pending = deferred()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    const state = setup()
    state.draft.value.title = 'Submitted English'
    const save = state.save()
    state.activeLang.value = 'de'
    state.draft.value.title = 'New German buffer'
    if (outcome === 'success')
      pending.resolve({ translation: row('en', { title: 'Submitted English', updatedAt: savedVersion }) })
    else
      pending.reject(
        outcome === 'conflict' ? { data: { data: { code: 'ARTICLE_EDIT_CONFLICT' } } } : new Error('Offline'),
      )
    await save
    expect(state.draft.value.title).toBe('New German buffer')
    expect(state.conflict.value).toBe(false)
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it('does not update disposed buffers or refresh their view after a committed save', async () => {
    const pending = deferred()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    const state = setup()
    state.draft.value.title = 'Submitted title'
    const save = state.save()
    state.scope.stop()
    pending.resolve({ translation: row('en', { title: 'Submitted title', updatedAt: savedVersion }) })
    await save
    expect(mocks.invalidate).toHaveBeenCalledTimes(1)
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(mocks.toast).not.toHaveBeenCalled()
    expect(data.value.translations[0]!.updatedAt).toBe(initialVersion)
  })

  it('requires an explicit observed replacement for AI translation and creates missing rows separately', async () => {
    const state = setup()
    await state.translateNow()
    expect(mocks.fetch.mock.lastCall).toMatchObject([
      '/api/articles/article-1/translate',
      {
        method: 'POST',
        body: { language: 'en', replace: true, expectedUpdatedAt: initialVersion },
      },
    ])
    state.activeLang.value = 'fr'
    mocks.fetch.mockResolvedValueOnce({ translation: row('fr', { updatedAt: savedVersion }) })
    await state.translateNow()
    expect(mocks.fetch.mock.lastCall![1].body).toEqual({
      language: 'fr',
      replace: false,
      expectedUpdatedAt: null,
      background: true,
    })
    expect(state.draft.value.title).toBe('fr title')
  })

  it('starts a missing translation after Tiptap normalizes its empty body', async () => {
    const state = setup('fr')
    state.draft.value.content = '<p></p>'
    mocks.fetch.mockResolvedValueOnce({
      translation: row('fr', { title: null, excerpt: null, content: null, status: 'TRANSLATING' }),
    })
    await state.translateNow()
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('/api/articles/article-1/translate', {
      method: 'POST',
      body: { language: 'fr', replace: false, expectedUpdatedAt: null, background: true },
    })
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(state.pending.value).toBe('translate')
    data.value = { ...data.value, translations: [row('fr', { updatedAt: savedVersion })] }
    expect(state.draft.value.title).toBe('fr title')
    expect(state.isDirty.value).toBe(false)
    expect(state.pending.value).toBeNull()
  })

  it.each([false, true])('asks before replacing unsaved translation edits (confirmed: %s)', async (confirmed) => {
    const state = setup('fr')
    state.draft.value.title = 'Unsaved title'
    mocks.confirm.mockResolvedValueOnce(confirmed)
    mocks.fetch.mockResolvedValueOnce({ translation: row('fr') })
    await state.translateNow()
    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ variant: 'danger' }))
    expect(mocks.fetch).toHaveBeenCalledTimes(confirmed ? 1 : 0)
    expect(state.draft.value.title).toBe(confirmed ? 'fr title' : 'Unsaved title')
  })

  it('does not apply an overwrite confirmation to another language or newer edits', async () => {
    let answer!: (value: boolean) => void
    mocks.confirm.mockImplementation(() => new Promise<boolean>((resolve) => (answer = resolve)))
    const state = setup('fr')
    state.draft.value.title = 'Unsaved title'
    const switched = state.translateNow()
    state.activeLang.value = 'de'
    answer(true)
    await switched
    expect(mocks.fetch).not.toHaveBeenCalled()
    state.draft.value.title = 'Another title'
    const edited = state.translateNow()
    state.draft.value.title = 'Newer title'
    answer(true)
    await edited
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(state.draft.value.title).toBe('Newer title')
  })

  it('sends the captured nullable edit token when discarding and resets an unchanged removed buffer', async () => {
    data.value = { ...data.value, translations: [row('en', { updatedAt: null })] }
    const state = setup()
    mocks.fetch.mockResolvedValueOnce({ ok: true })
    await state.discard()
    expect(mocks.fetch.mock.lastCall).toMatchObject([
      '/api/translations/translation-en',
      {
        method: 'DELETE',
        body: { expectedUpdatedAt: null },
      },
    ])
    expect(state.draft.value).toEqual({ title: '', excerpt: '', content: '' })
    expect(state.hasBody.value).toBe(false)
  })

  it('keeps an edited buffer visible when its row is removed by a refresh', async () => {
    const state = setup()
    state.draft.value.content = '<p>Unsaved content</p>'
    data.value = { ...data.value, translations: [] }
    await nextTick()
    expect(state.draft.value.content).toBe('<p>Unsaved content</p>')
    expect(state.hasBody.value).toBe(true)
    expect(state.conflict.value).toBe(true)
  })

  it('retains a successful save when subsequent list invalidation fails', async () => {
    mocks.invalidate.mockRejectedValueOnce(new Error('Cache unavailable'))
    const state = setup()
    state.draft.value.title = 'Persisted title'
    mocks.fetch.mockResolvedValueOnce({ translation: row('en', { title: 'Persisted title', updatedAt: savedVersion }) })
    await state.save()
    expect(state.isDirty.value).toBe(false)
    expect(state.conflict.value).toBe(false)
    expect(mocks.toast).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ color: 'success' }))
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('reports a current conflict and preserves a deep link until the initial payload arrives', async () => {
    status.value = 'pending'
    data.value = { translations: [], targetLanguages: [], translationMode: 'OFF' }
    const state = setup('de')
    expect(state.activeLang.value).toBe('de')
    data.value = { translations: [row('de')], targetLanguages: ['de'], translationMode: 'MANUAL' }
    status.value = 'success'
    await nextTick()
    expect(state.draft.value.title).toBe('de title')
    state.draft.value.title = 'My edit'
    mocks.fetch.mockRejectedValueOnce({ data: { code: 'ARTICLE_VERSION_REQUIRED' } })
    await state.save()
    expect(state.conflict.value).toBe(true)
    expect(state.draft.value.title).toBe('My edit')
    expect(mocks.toast).not.toHaveBeenCalled()
  })
})

// @vitest-environment nuxt

import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { effectScope, reactive, ref, shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ArticleWithDetails } from '../../types/article'
import type { GenerationSnapshot } from '../../shared/types/articleGeneration'

import { useArticleGenerationRecovery } from '../../app/composables/useArticleGenerationRecovery'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), lazyFetch: vi.fn(), refresh: vi.fn() }))
const recoverable = shallowRef<{ id: string; recoverableSnapshot: GenerationSnapshot | null } | null>(null)
mockNuxtImport('$fetch', () => mocks.fetch)
mockNuxtImport('useLazyFetch', () => mocks.lazyFetch)

const setup = (target: string | null = 'new') => {
  const scope = effectScope()
  const options = {
    documentKey: target ?? 'article-slug',
    target: shallowRef(target),
    editedArticle: ref<ArticleWithDetails>({
      id: '',
      createdAt: '',
      title: 'Current title',
      slug: 'current',
      excerpt: 'Current excerpt',
      content: '<p>Current</p>',
      imageUrl: '/current.webp',
      imageCredit: { author: 'Current' },
      coverMediaId: 'current-media',
      answer: 'Current answer',
      keyTakeaways: ['Current takeaway'],
      faq: [],
      readingTime: null,
      views: 0,
      status: 'draft',
      releaseAt: null,
      aiInvolvement: 'NONE',
      savedAmount: 1,
      savedTimeMinutes: 1,
      user: null,
      tags: [],
      _count: null,
    }),
    articleTags: shallowRef(['old-tag']),
    ownsGeneration: shallowRef(true),
    generation: reactive({ sessionId: 'active-session' as string | null, clear: vi.fn() }),
    onRestored: vi.fn().mockResolvedValue(true),
  }
  const recovery = scope.run(() => useArticleGenerationRecovery(options))!
  scopes.push(scope)
  return { ...recovery, options }
}
const scopes: ReturnType<typeof effectScope>[] = []
beforeEach(() => {
  vi.clearAllMocks()
  recoverable.value = null
  mocks.fetch.mockResolvedValue({ success: true })
  mocks.lazyFetch.mockReturnValue({ data: recoverable, refresh: mocks.refresh })
})
afterEach(() => scopes.splice(0).forEach((scope) => scope.stop()))

describe('editor generation recovery', () => {
  it('applies available partial fields, preserves absent fields and honors explicit null/zero values', async () => {
    const { restoreGeneration, options } = setup()
    recoverable.value = {
      id: 'recovered-session',
      recoverableSnapshot: {
        title: 'Recovered title',
        articleImageUrl: null,
        articleImageCredit: null,
        articleCoverMediaId: null,
        answer: null,
        tags: ['new-tag'],
        metrics: { totalWords: 0, savedAmount: 0, savedTimeMinutes: 0 },
      },
    }
    await restoreGeneration()
    expect(options.editedArticle.value).toMatchObject({
      title: 'Recovered title',
      content: '<p>Current</p>',
      excerpt: 'Current excerpt',
      imageUrl: null,
      imageCredit: null,
      coverMediaId: null,
      answer: null,
      aiInvolvement: 'FULL',
      totalWords: 0,
      savedAmount: 0,
      savedTimeMinutes: 0,
    })
    expect(options.articleTags.value).toEqual(['new-tag'])
    expect(options.onRestored).toHaveBeenCalledTimes(1)
    expect(recoverable.value).toBeNull()
  })

  it('marks the restored and active sessions once each after saving', async () => {
    const { restoreGeneration, markGenerationSessionsSaved, options } = setup()
    recoverable.value = { id: 'active-session', recoverableSnapshot: { content: '<p>Recovered</p>' } }
    await restoreGeneration()
    await markGenerationSessionsSaved()
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(mocks.fetch).toHaveBeenCalledWith('/api/articles/generations/active-session', {
      method: 'PATCH',
      body: { action: 'restore' },
    })
    expect(options.generation.clear).toHaveBeenCalledTimes(1)
  })

  it('does not clear a newer running session while acknowledging an older saved one', async () => {
    let finish!: () => void
    mocks.fetch.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)))
    const { markGenerationSessionsSaved, options } = setup()
    const acknowledgement = markGenerationSessionsSaved()
    options.generation.sessionId = 'newer-session'
    finish()
    await acknowledgement
    expect(options.generation.clear).not.toHaveBeenCalled()
  })

  it('does not remove a newer recovery offer when dismissing an older session completes', async () => {
    let finish!: () => void
    mocks.fetch.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)))
    const { dismissGeneration } = setup()
    recoverable.value = { id: 'older-session', recoverableSnapshot: { title: 'Older' } }
    const dismiss = dismissGeneration()
    recoverable.value = { id: 'newer-session', recoverableSnapshot: { title: 'Newer' } }
    finish()
    await dismiss
    expect(recoverable.value?.id).toBe('newer-session')
  })

  it('retains recovery on a failed dismissal and safely ignores a missing snapshot', async () => {
    const { restoreGeneration, dismissGeneration, options } = setup()
    recoverable.value = { id: 'unavailable-session', recoverableSnapshot: null }
    await restoreGeneration()
    expect(options.onRestored).not.toHaveBeenCalled()
    mocks.fetch.mockRejectedValueOnce(new Error('Offline'))
    await expect(dismissGeneration()).rejects.toThrow('Offline')
    expect(recoverable.value?.id).toBe('unavailable-session')
  })

  it('does not fetch an existing document until its article identity has been loaded', () => {
    const { options } = setup(null)
    expect(mocks.lazyFetch.mock.lastCall?.[1]).toMatchObject({
      key: 'article-generation-recoverable-article-slug',
      server: false,
      immediate: false,
      watch: false,
    })
    options.target.value = 'loaded-article'
    expect(mocks.lazyFetch.mock.lastCall?.[1].query.value).toEqual({ articleId: 'loaded-article' })
  })
})

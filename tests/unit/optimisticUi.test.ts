// @vitest-environment nuxt

import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useArticleReaction } from '../../app/composables/useArticleReaction'

const mocks = vi.hoisted(() => ({
  toast: { add: vi.fn() },
  status: {
    saving: vi.fn(),
    saved: vi.fn(),
    reverted: vi.fn(),
  },
}))

mockNuxtImport('useToast', () => () => mocks.toast)
mockNuxtImport('useOptimisticStatus', () => () => mocks.status)
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('optimistic article reactions', () => {
  beforeEach(() => {
    clearNuxtState('article-card-reactions')
    clearNuxtState('article-reaction-pending')
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('updates immediately and rolls back when the request fails', async () => {
    const request = deferred<{ liked: boolean; likes: number }>()
    const fetcher = vi.fn(() => request.promise)
    const reaction = useArticleReaction('article-1', { liked: false, likes: 4 }, fetcher)

    const pending = reaction.toggle()
    expect(reaction.liked.value).toBe(true)
    expect(reaction.likes.value).toBe(5)
    expect(reaction.isPending.value).toBe(true)

    request.reject(new Error('offline'))
    await pending

    expect(reaction.liked.value).toBe(false)
    expect(reaction.likes.value).toBe(4)
    expect(mocks.status.reverted).toHaveBeenCalledOnce()
  })

  it('coalesces a double click into one request', async () => {
    const request = deferred<{ liked: boolean; likes: number }>()
    const fetcher = vi.fn(() => request.promise)
    const reaction = useArticleReaction('article-2', { liked: false, likes: 1 }, fetcher)

    const first = reaction.toggle()
    const second = reaction.toggle()
    expect(fetcher).toHaveBeenCalledOnce()

    request.resolve({ liked: true, likes: 2 })
    await Promise.all([first, second])
    expect(reaction.likes.value).toBe(2)
  })

  it('keeps each entity correct when responses arrive in the opposite order', async () => {
    const first = deferred<{ liked: boolean; likes: number }>()
    const second = deferred<{ liked: boolean; likes: number }>()
    const fetcher = vi.fn((url: string) => (url.includes('article-a') ? first.promise : second.promise))
    const reactionA = useArticleReaction('article-a', { liked: false, likes: 2 }, fetcher)
    const reactionB = useArticleReaction('article-b', { liked: true, likes: 8 }, fetcher)

    const pendingA = reactionA.toggle()
    const pendingB = reactionB.toggle()
    second.resolve({ liked: false, likes: 7 })
    await pendingB
    first.resolve({ liked: true, likes: 3 })
    await pendingA

    expect({ liked: reactionA.liked.value, likes: reactionA.likes.value }).toEqual({ liked: true, likes: 3 })
    expect({ liked: reactionB.liked.value, likes: reactionB.likes.value }).toEqual({ liked: false, likes: 7 })
  })
})

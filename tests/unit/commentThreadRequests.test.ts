// @vitest-environment nuxt

import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import { clearNuxtData, useNuxtApp } from '#app'

import type { CommentPage, CommentWithReplies } from '../../types/comment'

import { flattenCommentThreads } from '../../shared/utils/commentThreads'
import { useCommentThreads } from '../../app/composables/useCommentThreads'

const mocks = vi.hoisted(() => ({ root: vi.fn(), branch: vi.fn(), toast: vi.fn() }))
const auth = shallowRef({ user: { id: 'viewer', role: 'reader', clientSiteId: 'site-1' } })
mockNuxtImport('useRequestFetch', () => () => mocks.root)
mockNuxtImport('$fetch', () => mocks.branch)
mockNuxtImport('useAuth', () => () => ({ data: auth }))
mockNuxtImport('useToast', () => () => ({ add: mocks.toast }))
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))

const comment = (
  id: string,
  parentId: string | null = null,
  replies: CommentWithReplies[] = [],
): CommentWithReplies => ({
  id,
  parentId,
  replies,
  articleId: 'article-1',
  userId: 'reader',
  content: id,
  gifUrl: null,
  createdAt: new Date(0),
  deletedAt: null,
  user: null,
  article: { clientSiteId: 'site-1' },
  likes: 0,
  dislikes: 0,
  userReaction: null,
  emojiReactions: [],
  depth: 1,
  publicationLikes: 0,
})
const page = (comments = [comment('root')], hasMore = false): CommentPage => ({ comments, hasMore })
const deferred = () => {
  let resolve!: (page: CommentPage) => void
  let reject!: (error: Error) => void
  const promise = new Promise<CommentPage>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
const mountThreads = async () => {
  const articleId = shallowRef('article-1')
  const sort = shallowRef('createdAt:desc')
  let state!: ReturnType<typeof useCommentThreads>
  const Component = defineComponent({
    setup() {
      state = useCommentThreads(articleId, sort)
      return () =>
        h(
          'div',
          flattenCommentThreads(state.comments.value).map(({ comment }) =>
            h('span', { 'data-comment-id': comment.id }, comment.content),
          ),
        )
    },
  })
  const wrapper = await mountSuspended(Component)
  await flushPromises()
  return { wrapper, state, articleId, sort }
}
const initialKey = 'comment-threads:article-1:["viewer","reader","site-1"]'

enableAutoUnmount(afterEach)
beforeEach(() => {
  clearNuxtData((key) => key.startsWith('comment-threads:'))
  vi.clearAllMocks()
  mocks.root.mockReset().mockResolvedValue(page())
  mocks.branch.mockReset().mockResolvedValue(page())
  auth.value = { user: { id: 'viewer', role: 'reader', clientSiteId: 'site-1' } }
})
afterEach(() => {
  useNuxtApp().isHydrating = false
})

describe('comment thread request ownership', () => {
  it('reuses SSR payload and explicitly fetches fresh first-page data even during hydration', async () => {
    const app = useNuxtApp()
    app.payload.data[initialKey] = {
      ...page([comment('ssr')]),
      articleId: 'article-1',
      sort: 'createdAt:desc',
      page: 1,
    }
    app.payload.serverRendered = true
    app.isHydrating = true
    const { wrapper, state } = await mountThreads()
    expect(wrapper.text()).toContain('ssr')
    expect(mocks.root).not.toHaveBeenCalled()
    mocks.root.mockResolvedValueOnce(page([comment('fresh')]))
    await state.refresh()
    await flushPromises()
    expect(mocks.root).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('fresh')
    expect(wrapper.text()).toContain('ssr')
  })

  it('retries a failed root page with the same page number and preserves loaded comments', async () => {
    mocks.root.mockResolvedValueOnce(page([comment('root')], true))
    const { state } = await mountThreads()
    mocks.root.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(page([comment('second')]))
    await state.loadMore()
    expect(state.comments.value.map((row) => row.id)).toEqual(['root'])
    expect(state.error.value).toBeTruthy()
    await state.loadMore()
    expect(mocks.root.mock.calls.slice(1).map((call) => call[1].query.page)).toEqual([2, 2])
    expect(state.comments.value.map((row) => row.id)).toEqual(['root', 'second'])
  })

  it('loads each direct-child page once and advances only that parent’s cursor', async () => {
    const root = { ...comment('root', null, [comment('one', 'root')]), repliesHasMore: true, repliesCursor: 'one' }
    mocks.root.mockResolvedValueOnce(page([root]))
    const pending = deferred()
    mocks.branch.mockReturnValueOnce(pending.promise)
    const { state } = await mountThreads()
    const first = state.loadReplies(state.comments.value[0]!)
    await state.loadReplies(state.comments.value[0]!)
    expect(mocks.branch).toHaveBeenCalledTimes(1)
    expect(state.pendingReplies.has('root')).toBe(true)
    pending.resolve({ ...page([comment('two', 'root')]), parent: { id: 'root', cursor: 'two', hasMore: false } })
    await first
    expect(state.comments.value[0]?.replies.map((row) => row.id)).toEqual(['one', 'two'])
    expect(state.comments.value[0]?.repliesCursor).toBe('two')
    expect(state.comments.value[0]?.repliesHasMore).toBe(false)
    expect(state.pendingReplies.has('root')).toBe(false)
    expect(mocks.branch.mock.calls[0]?.[1].query).toEqual({ parent: 'root', cursor: 'one' })
  })

  it('loads earlier context while retaining the deep target and existing first page', async () => {
    const partial = { ...comment('partial', 'parent', [comment('target', 'partial')]), contextParentId: 'parent' }
    mocks.root.mockResolvedValueOnce(page([comment('other-root'), partial]))
    mocks.branch.mockResolvedValueOnce(page([comment('root', null, [comment('parent', 'root')])]))
    const { state } = await mountThreads()
    await state.loadContext(partial)
    expect(state.comments.value.map((row) => row.id)).toEqual(['root', 'other-root'])
    expect(state.index.value.has('target')).toBe(true)
    expect(state.index.value.get('partial')?.contextParentId).toBeUndefined()
    expect(mocks.branch.mock.calls[0]?.[1].query).toEqual({ target: 'parent' })
  })

  it.each(['success', 'failure'])(
    'ignores stale reply %s after changing articles and aborts its request',
    async (outcome) => {
      mocks.root.mockResolvedValueOnce(page([{ ...comment('root'), repliesHasMore: true }]))
      const pending = deferred()
      mocks.branch.mockReturnValueOnce(pending.promise)
      const { state, articleId } = await mountThreads()
      const request = state.loadReplies(state.comments.value[0]!)
      mocks.root.mockResolvedValueOnce(page([comment('new-article')]))
      articleId.value = 'article-2'
      await nextTick()
      if (outcome === 'success') pending.resolve(page([comment('stale', 'root')]))
      else pending.reject(new Error('Old request failed'))
      await request
      await flushPromises()
      expect(mocks.branch.mock.calls[0]?.[1].signal.aborted).toBe(true)
      expect(state.index.value.has('stale')).toBe(false)
      expect(state.comments.value.map((row) => row.id)).toEqual(['new-article'])
      expect(mocks.toast).not.toHaveBeenCalled()
    },
  )

  it('retains the latest sort response when canceled root requests finish out of order', async () => {
    const { state, sort } = await mountThreads()
    const old = deferred()
    const latest = deferred()
    mocks.root.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise)
    sort.value = 'createdAt:asc'
    await nextTick()
    sort.value = 'likes:desc'
    await nextTick()
    latest.resolve(page([comment('newest-sort')]))
    await flushPromises()
    old.resolve(page([comment('stale-sort')]))
    await flushPromises()
    expect(state.comments.value.map((row) => row.id)).toEqual(['newest-sort'])
  })

  it('clears private thread metadata when the same administrator switches active tenants', async () => {
    const { state } = await mountThreads()
    const pending = deferred()
    mocks.root.mockReturnValueOnce(pending.promise)
    auth.value = { user: { id: 'viewer', role: 'admin', clientSiteId: 'other-site' } }
    expect(state.comments.value).toEqual([])
    pending.resolve(page([comment('public-view')]))
    await flushPromises()
    expect(state.comments.value.map((row) => row.id)).toEqual(['public-view'])
  })

  it('reports a current reply failure and preserves its cursor for retry', async () => {
    const root = { ...comment('root'), repliesHasMore: true, repliesCursor: 'cursor' }
    mocks.root.mockResolvedValueOnce(page([root]))
    mocks.branch.mockRejectedValueOnce(new Error('Offline'))
    const { state } = await mountThreads()
    await state.loadReplies(root)
    expect(state.index.value.get('root')?.repliesCursor).toBe('cursor')
    expect(state.pendingReplies.has('root')).toBe(false)
    expect(mocks.toast).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ color: 'error' }))
  })

  it('refreshes a deeply loaded moderation target while retaining earlier pages and replies', async () => {
    const deep = { ...comment('deep', 'older'), user: { username: 'Reader', isBanned: true } }
    mocks.root.mockResolvedValueOnce(
      page([comment('first-page'), comment('older', null, [deep, comment('loaded-sibling', 'older')])]),
    )
    mocks.branch.mockResolvedValueOnce(
      page([comment('older', null, [{ ...deep, user: { ...deep.user, isBanned: false } }])]),
    )
    const { state } = await mountThreads()
    await state.refreshComment(deep)
    expect(mocks.branch.mock.calls[0]?.[1].query).toEqual({ target: 'deep' })
    expect(state.comments.value.map((row) => row.id)).toEqual(['first-page', 'older'])
    expect(state.index.value.get('deep')?.user?.isBanned).toBe(false)
    expect(state.index.value.has('loaded-sibling')).toBe(true)
    expect(mocks.root).toHaveBeenCalledTimes(1)
  })

  it('aborts pending branch work on unmount and ignores its late result', async () => {
    mocks.root.mockResolvedValueOnce(page([{ ...comment('root'), repliesHasMore: true }]))
    const pending = deferred()
    mocks.branch.mockReturnValueOnce(pending.promise)
    const { state, wrapper } = await mountThreads()
    const request = state.loadReplies(state.comments.value[0]!)
    wrapper.unmount()
    pending.resolve(page([comment('late', 'root')]))
    await request
    expect(mocks.branch.mock.calls[0]?.[1].signal.aborted).toBe(true)
    expect(state.index.value.has('late')).toBe(false)
    expect(mocks.toast).not.toHaveBeenCalled()
  })
})

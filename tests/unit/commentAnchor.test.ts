// @vitest-environment nuxt

import type { CommentWithReplies } from '~~/types/comment'

import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { defineComponent, h, reactive, shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'

import { useCommentAnchor } from '../../app/composables/useCommentAnchor'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), toast: { add: vi.fn() } }))
const route = reactive({ hash: '' })
mockNuxtImport('useRoute', () => () => route)
mockNuxtImport('useToast', () => () => mocks.toast)
mockNuxtImport('$fetch', () => mocks.fetch)
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))

const comment = (id: string, replies: CommentWithReplies[] = []) =>
  ({ id, content: `Comment ${id}`, replies }) as CommentWithReplies
const renderComment = (c: CommentWithReplies): ReturnType<typeof h> =>
  h('article', { id: `comment-${c.id}`, tabindex: -1 }, [c.content, ...c.replies.map(renderComment)])
const harness = (initial: CommentWithReplies[]) =>
  defineComponent({
    setup() {
      const comments = shallowRef(initial)
      useCommentAnchor(shallowRef('article-1'), comments)
      return () => h('section', comments.value.map(renderComment))
    },
  })
const mountComments = (initial = [comment('newest')]) => mount(harness(initial), { attachTo: document.body })
const scrollIntoView = vi.fn()
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })

enableAutoUnmount(afterEach)
beforeEach(() => {
  route.hash = ''
  vi.clearAllMocks()
  mocks.fetch.mockResolvedValue({ comments: [] })
})

describe('comment permalink navigation', () => {
  it('scrolls to and focuses a rendered nested reply without another request', async () => {
    route.hash = '#comment-reply'
    mountComments([comment('newest', [comment('reply')])])
    await flushPromises()
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(scrollIntoView).toHaveBeenCalledOnce()
    expect((scrollIntoView.mock.instances[0] as HTMLElement).id).toBe('comment-reply')
    expect(document.activeElement?.id).toBe('comment-reply')
  })

  it('renders a missing thread before scrolling to its nested target and keeps the first page', async () => {
    route.hash = '#comment-older-reply'
    mocks.fetch.mockResolvedValue({ comments: [comment('older', [comment('older-reply')])] })
    const wrapper = mountComments()
    await flushPromises()
    expect(mocks.fetch).toHaveBeenCalledWith('/api/comments/article-1', {
      query: { target: 'older-reply' },
      signal: expect.any(AbortSignal),
    })
    expect(wrapper.text()).toContain('Comment newest')
    expect(wrapper.text()).toContain('Comment older-reply')
    expect(document.activeElement?.id).toBe('comment-older-reply')
    expect((scrollIntoView.mock.instances[0] as HTMLElement).isConnected).toBe(true)
  })

  it('handles a new hash on the same article', async () => {
    mountComments([comment('newest', [comment('reply')])])
    route.hash = '#comment-reply'
    await flushPromises()
    expect(document.activeElement?.id).toBe('comment-reply')
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('ignores an old request when the reader navigates to another comment', async () => {
    let resolveOld!: (result: { comments: CommentWithReplies[] }) => void
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => (resolveOld = resolve)))
    route.hash = '#comment-older'
    const wrapper = mountComments([comment('newest', [comment('reply')])])
    route.hash = '#comment-reply'
    await flushPromises()
    resolveOld({ comments: [comment('older')] })
    await flushPromises()
    expect(wrapper.text()).not.toContain('Comment older')
    expect(document.activeElement?.id).toBe('comment-reply')
    expect(scrollIntoView).toHaveBeenCalledOnce()
  })

  it.each(['#comments', '#article-heading', '#comment-'])('leaves other anchors alone: %s', async (hash) => {
    route.hash = hash
    mountComments()
    await flushPromises()
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('leaves the discussion available when the target is missing or inaccessible', async () => {
    route.hash = '#comment-missing'
    const wrapper = mountComments()
    await flushPromises()
    expect(wrapper.text()).toContain('Comment newest')
    expect(mocks.fetch).toHaveBeenCalledOnce()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('reports a failed thread request without losing the discussion', async () => {
    route.hash = '#comment-older'
    mocks.fetch.mockRejectedValue(new Error('offline'))
    const wrapper = mountComments()
    await flushPromises()
    expect(wrapper.text()).toContain('Comment newest')
    expect(mocks.toast.add).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})

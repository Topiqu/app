// @vitest-environment nuxt

import { computed, defineComponent, h, shallowRef } from 'vue'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import type { CommentWithReplies } from '../../types/comment'

import Section from '../../app/components/Comment/Section.vue'
import CommentNode from '../../app/components/Comment/index.vue'
import { indexCommentThreads } from '../../shared/utils/commentThreads'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  toast: vi.fn(),
  refresh: vi.fn(),
  refreshComment: vi.fn(),
  invalidate: vi.fn(),
  more: vi.fn(),
  replies: vi.fn(),
  context: vi.fn(),
  confirm: vi.fn(),
  scroll: vi.fn(),
}))
const auth = shallowRef<{ user: { id: string; name: string; avatarUrl: string | null; clientSiteId: string } } | null>(
  null,
)
const comments = shallowRef<CommentWithReplies[]>([])
const threadState = {
  ready: Promise.resolve(),
  comments,
  index: computed(() => indexCommentThreads(comments.value)),
  error: shallowRef<Error | null>(null),
  loading: shallowRef(false),
  hasMore: shallowRef(false),
  pendingReplies: new Set<string>(),
  pendingContexts: new Set<string>(),
  refresh: mocks.refresh,
  refreshComment: mocks.refreshComment,
  loadMore: mocks.more,
  loadReplies: mocks.replies,
  loadContext: mocks.context,
}
mockNuxtImport('useAuth', () => () => ({ data: auth, signOut: vi.fn() }))
mockNuxtImport(
  '$fetch',
  () => (url: string, options: unknown) =>
    url === '/api/sessions/ping' ? Promise.resolve({ ok: true }) : mocks.fetch(url, options),
)
mockNuxtImport('useCommentThreads', () => () => threadState)
mockNuxtImport('useCommentAnchor', () => () => {})
mockNuxtImport('useInfiniteScroll', () => mocks.scroll)
mockNuxtImport('useToast', () => () => ({ add: mocks.toast }))
mockNuxtImport('useConfirm', () => () => mocks.confirm)
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: shallowRef('en') }))
mockNuxtImport('useLocalePath', () => () => () => '/login')
mockNuxtImport('useClientSite', () => async () => null)
mockNuxtImport('useCacheInvalidation', () => () => ({ invalidateArticleDetail: mocks.invalidate }))
mockNuxtImport('useOptimisticStatus', () => () => ({ saving: () => 1, saved: vi.fn(), reverted: vi.fn() }))
mockNuxtImport('useCommentPermissions', () => () => ({ isBanned: false, isSiteAdmin: false, user: null }))
mockNuxtImport('useCommentReactions', () => () => ({
  state: { userReaction: null, likes: 0, dislikes: 0, emojiReactions: [], publicationLikes: 0 },
  isPending: shallowRef(false),
  updateReaction: vi.fn(),
  handleEmojiReaction: vi.fn(),
}))

const comment = (id: string, parentId: string | null = null): CommentWithReplies => ({
  id,
  parentId,
  replies: [],
  articleId: 'article-1',
  userId: 'viewer',
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
const CommentStub = defineComponent({
  name: 'CommentHarness',
  props: ['comment', 'depth', 'pendingReplies', 'pendingContexts'],
  emits: ['reply', 'delete', 'loadReplies', 'loadContext', 'refresh'],
  setup: (props) => () => h('div', { 'data-comment': props.comment.id }, props.comment.content),
})
const global = {
  renderStubDefaultSlot: true,
  mocks: { $t: (key: string) => key },
  stubs: {
    Comment: CommentStub,
    GifSelector: true,
    Gif: true,
    UAlert: { template: '<div role="alert"><slot name="actions" /></div>' },
  },
}
const mountSection = () =>
  mountSuspended(Section, {
    props: { articleId: 'article-1', commCount: 0, allowComments: true, allowGifs: false },
    shallow: true,
    global,
  })
const submit = async (wrapper: Awaited<ReturnType<typeof mountSection>>, content = 'New comment') => {
  wrapper.findComponent({ name: 'UTextarea' }).vm.$emit('update:modelValue', content)
  wrapper.findComponent({ name: 'UForm' }).vm.$emit('submit', { preventDefault: vi.fn() })
  await flushPromises()
}
const deferred = () => {
  let resolve!: (value: unknown) => void
  const promise = new Promise((res) => {
    resolve = res
  })
  return { promise, resolve }
}

enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.clearAllMocks()
  auth.value = null
  comments.value = [comment('root')]
  threadState.loading.value = false
  threadState.error.value = null
  threadState.hasMore.value = false
  mocks.fetch.mockResolvedValue({
    id: 'created',
    content: 'New comment',
    gifUrl: null,
    createdAt: '2026-10-22T12:00:00Z',
    parentId: null,
  })
  mocks.refresh.mockResolvedValue(undefined)
  mocks.invalidate.mockResolvedValue(undefined)
  mocks.confirm.mockResolvedValue(true)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('comment section pagination and flat rendering', () => {
  it('renders 600 nested comments as sibling components in parent-before-child order', async () => {
    const root = comment('node-0')
    let parent = root
    for (let position = 1; position < 600; position++) {
      const child = comment(`node-${position}`, parent.id)
      parent.replies.push(child)
      parent = child
    }
    comments.value = [root]
    const wrapper = await mountSection()
    const nodes = wrapper.findAllComponents(CommentStub)
    expect(nodes).toHaveLength(600)
    expect(nodes[0]?.props('comment').id).toBe('node-0')
    expect(nodes.at(-1)?.props('comment').id).toBe('node-599')
    expect(nodes.at(-1)?.props('depth')).toBe(12)
    expect(nodes[0]?.findAllComponents(CommentStub)).toHaveLength(0)
  })

  it('forwards independent reply/context actions and exposes keyboard-accessible root pagination', async () => {
    threadState.hasMore.value = true
    const wrapper = await mountSection()
    wrapper.findComponent(CommentStub).vm.$emit('loadReplies', comments.value[0])
    wrapper.findComponent(CommentStub).vm.$emit('loadContext', comments.value[0])
    wrapper.findComponent(CommentStub).vm.$emit('refresh', comments.value[0])
    wrapper
      .findAllComponents({ name: 'UButton' })
      .find((button) => button.text() === 'articles.comments.loadMoreComments')!
      .vm.$emit('click')
    expect(mocks.replies).toHaveBeenCalledWith(comments.value[0])
    expect(mocks.context).toHaveBeenCalledWith(comments.value[0])
    expect(mocks.refreshComment).toHaveBeenCalledWith(comments.value[0])
    expect(mocks.more).toHaveBeenCalledTimes(1)
  })

  it('keeps loaded threads visible during a page error with a retry action', async () => {
    threadState.error.value = new Error('Offline')
    threadState.hasMore.value = true
    const wrapper = await mountSection()
    expect(wrapper.findComponent(CommentStub).exists()).toBe(true)
    const options = mocks.scroll.mock.calls[0]?.[2]
    expect(options.canLoadMore()).toBe(false)
    wrapper
      .findAllComponents({ name: 'UButton' })
      .find((button) => button.text() === 'common.messages.retry')!
      .vm.$emit('click')
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    threadState.error.value = null
    expect(options.canLoadMore()).toBe(true)
    threadState.loading.value = true
    expect(options.canLoadMore()).toBe(false)
  })
})

describe('comment mutation ownership', () => {
  const signedIn = () => {
    auth.value = { user: { id: 'viewer', name: 'Reader', avatarUrl: null, clientSiteId: 'site-1' } }
  }

  it('keeps a committed comment successful when cache/read refresh fails', async () => {
    signedIn()
    mocks.refresh.mockRejectedValueOnce(new Error('Read unavailable'))
    mocks.invalidate.mockRejectedValueOnce(new Error('Cache unavailable'))
    const wrapper = await mountSection()
    await submit(wrapper)
    expect(comments.value[0]?.id).toBe('created')
    expect(wrapper.find('h2').text()).toContain('(1)')
    expect(mocks.toast).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ color: 'success' }))
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('restores the submitted text and removes only the optimistic row on failure', async () => {
    signedIn()
    mocks.fetch.mockRejectedValueOnce(new Error('Offline'))
    const wrapper = await mountSection()
    await submit(wrapper)
    expect(comments.value.map((row) => row.id)).toEqual(['root'])
    expect(wrapper.findComponent({ name: 'UTextarea' }).props('modelValue')).toBe('New comment')
    expect(wrapper.find('h2').text()).toContain('(0)')
    expect(mocks.toast).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ color: 'error' }))
  })

  it('preserves the submitted article target and prevents stale UI effects after navigation', async () => {
    signedIn()
    const pending = deferred()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    const wrapper = await mountSection()
    await submit(wrapper)
    comments.value = [comment('other-article')]
    await wrapper.setProps({ articleId: 'article-2' })
    pending.resolve({
      id: 'created-old',
      content: 'Old text',
      gifUrl: null,
      createdAt: '2026-10-22T12:00:00Z',
      parentId: null,
    })
    await flushPromises()
    expect(mocks.fetch.mock.calls[0]?.[1].body.articleId).toBe('article-1')
    expect(comments.value.map((row) => row.id)).toEqual(['other-article'])
    expect(mocks.invalidate).toHaveBeenCalledWith('article-1')
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(mocks.toast).not.toHaveBeenCalled()
  })
})

describe('comment continuation controls', () => {
  it('keeps deleted-parent reply/context continuation available and reflects pending state', async () => {
    const root = { ...comment('root'), deletedAt: new Date(), repliesHasMore: true, contextParentId: 'earlier' }
    const wrapper = await mountSuspended(CommentNode, {
      props: { comment: root, depth: 1, isReplying: false, publication: null },
      shallow: true,
      global,
    })
    const more = wrapper
      .findAllComponents({ name: 'UButton' })
      .find((button) => button.text() === 'articles.comments.loadMoreReplies')!
    const context = wrapper
      .findAllComponents({ name: 'UButton' })
      .find((button) => button.text() === 'articles.comments.loadEarlierContext')!
    more.vm.$emit('click')
    context.vm.$emit('click')
    expect(wrapper.emitted('loadReplies')).toEqual([[root]])
    expect(wrapper.emitted('loadContext')).toEqual([[root]])
    await wrapper.setProps({ pendingReplies: new Set(['root']), pendingContexts: new Set(['root']) })
    expect(more.props('disabled')).toBe(true)
    expect(context.props('loading')).toBe(true)
  })
})

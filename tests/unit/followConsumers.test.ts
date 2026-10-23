// @vitest-environment nuxt

import { defineComponent, h, shallowRef } from 'vue'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import { clearNuxtData } from '#app'

import Author from '../../app/pages/autor/[name].vue'
import Article from '../../app/pages/clanky/[slug].vue'
import Hero from '../../app/components/Article/Header/Hero.vue'

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  mutate: vi.fn(),
  toast: vi.fn(),
  saved: vi.fn(),
  reverted: vi.fn(),
}))
const auth = shallowRef<{ user: { id: string; role: string } } | null>({ user: { id: 'viewer', role: 'reader' } })
const authorFixture = (id = 'author') => ({
  id,
  username: id,
  bio: '',
  avatarUrl: '',
  articles: [],
  hasMore: false,
  total: 0,
  joinedAt: '2026-10-22T10:00:00Z',
  articleCount: 0,
  followerCount: 5,
  followingCount: 0,
})
const articleFixture = (id = 'article', userId = 'author') => ({
  id,
  slug: id,
  title: id,
  user: { id: userId, username: userId },
  userId,
  tags: [],
  faq: [],
  followerCount: 5,
  language: 'en',
  primaryLanguage: 'en',
  alternates: [],
})
const author = shallowRef(authorFixture())
const article = shallowRef(articleFixture())
const header = shallowRef<unknown>(null)

mockNuxtImport('useAuth', () => () => ({ data: auth, signOut: vi.fn() }))
mockNuxtImport('useRequestFetch', () => () => mocks.read)
mockNuxtImport(
  '$fetch',
  () => (url: string, options: unknown) =>
    url === '/api/sessions/ping' ? Promise.resolve({ ok: true }) : mocks.mutate(url, options),
)
mockNuxtImport('useFetch', () => async (url: string | (() => string)) => ({
  data:
    typeof url === 'string' && url.endsWith('/by-author') ? author : typeof url === 'string' ? article : shallowRef([]),
  pending: shallowRef(false),
  error: shallowRef(null),
  status: shallowRef('success'),
  refresh: vi.fn(),
}))
mockNuxtImport('useArticleFeed', () => async (key: string) => ({
  data: typeof key === 'string' && key.startsWith('author-') ? author : shallowRef([]),
  pending: shallowRef(false),
  error: shallowRef(null),
  status: shallowRef('success'),
  refresh: vi.fn(),
}))
mockNuxtImport('useRoute', () => () => ({
  path: '/author',
  fullPath: '/author',
  query: {},
  params: { name: 'author', slug: 'article' },
  hash: '',
  meta: {},
}))
mockNuxtImport('useToast', () => () => ({ add: mocks.toast }))
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: shallowRef('en') }))
mockNuxtImport('useLocalePath', () => () => () => '/author')
mockNuxtImport('useCanonicalOrigin', () => () => 'https://example.invalid')
mockNuxtImport('useClientSite', () => async () => ({ id: 'site', plan: 'BASIC' }))
mockNuxtImport('useSchemaOrg', () => () => {})
mockNuxtImport('useWidgetPagePreview', () => () => ({ active: shallowRef(false) }))
mockNuxtImport('useConsent', () => () => ({ marketingGranted: shallowRef(false) }))
mockNuxtImport('useAdSenseStatus', () => () => shallowRef('idle'))
mockNuxtImport('useArticleSeo', () => () => {})
mockNuxtImport('defineOgImage', () => () => {})
mockNuxtImport('useArticleTracking', () => () => ({ trackView: vi.fn() }))
mockNuxtImport('useArticleActions', () => () => ({
  share: vi.fn(),
  copyLink: vi.fn(),
  toggleComments: vi.fn(),
  debouncedSetStatus: vi.fn(),
}))
mockNuxtImport('useOptimisticStatus', () => () => ({ saving: () => 1, saved: mocks.saved, reverted: mocks.reverted }))
mockNuxtImport('useArticleReaction', () => () => ({
  liked: shallowRef(false),
  likes: shallowRef(0),
  isPending: shallowRef(false),
  toggle: vi.fn(),
}))
mockNuxtImport('useArticleHeaderContext', () => () => header)
mockNuxtImport('useArticleLikeBus', () => () => ({ on: vi.fn(), off: vi.fn() }))

const View = defineComponent({
  name: 'ArticleViewHarness',
  props: ['follow'],
  emits: ['follow'],
  setup: (props) => () => h('div', { 'data-following': props.follow.following, 'data-count': props.follow.count }),
})
const global = {
  mocks: { $t: (key: string) => key },
  renderStubDefaultSlot: true,
  stubs: { ArticleView: View },
}
const mountAuthor = () => mountSuspended(Author, { shallow: true, global })
const mountArticle = () => mountSuspended(Article, { shallow: true, global })
const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

enableAutoUnmount(afterEach)
beforeEach(() => {
  clearNuxtData((key) => key.startsWith('follow-status:'))
  vi.clearAllMocks()
  mocks.read.mockResolvedValue([])
  mocks.mutate.mockResolvedValue({ followerCount: 6 })
  auth.value = { user: { id: 'viewer', role: 'reader' } }
  author.value = authorFixture()
  article.value = articleFixture()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('author follow consumers', () => {
  it('renders the author and article list while the noncritical follow status is pending', async () => {
    const pending = deferred<{ id: string }[]>()
    mocks.read.mockReturnValueOnce(pending.promise)
    const wrapper = await mountAuthor()
    expect(wrapper.find('h1').text()).toBe('author')
    expect(wrapper.findComponent({ name: 'ArticleCollection' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'UButton' }).props('loading')).toBe(true)
    expect(mocks.mutate).not.toHaveBeenCalled()
    pending.resolve([])
    await flushPromises()
    expect(wrapper.findComponent({ name: 'UButton' }).props('loading')).toBe(false)
  })

  it('offers a read retry after status failure without sending a mutation', async () => {
    mocks.read.mockRejectedValueOnce(new Error('Offline'))
    const wrapper = await mountAuthor()
    await flushPromises()
    const button = wrapper.findComponent({ name: 'UButton' })
    expect(button.text()).toContain('common.messages.retry')
    button.vm.$emit('click')
    await flushPromises()
    expect(mocks.read).toHaveBeenCalledTimes(2)
    expect(mocks.mutate).not.toHaveBeenCalled()
    button.vm.$emit('click')
    await flushPromises()
    expect(mocks.mutate).toHaveBeenCalledExactlyOnceWith('/api/follows', {
      method: 'POST',
      body: { followedId: 'author' },
    })
    expect(author.value.followerCount).toBe(6)
  })

  it.each(['success', 'failure'])('ignores a stale author mutation %s after navigation', async (outcome) => {
    const wrapper = await mountAuthor()
    await flushPromises()
    const pending = deferred<{ followerCount: number }>()
    mocks.mutate.mockReturnValueOnce(pending.promise)
    wrapper.findComponent({ name: 'UButton' }).vm.$emit('click')
    author.value = { ...authorFixture('next-author'), followerCount: 20 }
    await flushPromises()
    if (outcome === 'success') pending.resolve({ followerCount: 6 })
    else pending.reject(new Error('Stale failure'))
    await flushPromises()
    expect(author.value.followerCount).toBe(20)
    expect(mocks.toast).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'UButton' }).props('loading')).toBe(false)
  })

  it('keeps article optimistic state synchronized after an authoritative false refresh', async () => {
    const wrapper = await mountArticle()
    await flushPromises()
    const view = wrapper.findComponent(View)
    expect(view.props('follow').following).toBe(false)
    view.vm.$emit('follow')
    await flushPromises()
    expect(view.props('follow').following).toBe(false)
    expect(mocks.mutate).toHaveBeenCalledExactlyOnceWith('/api/follows', {
      method: 'POST',
      body: { followedId: 'author' },
    })
  })

  it.each(['success', 'failure'])('ignores stale article mutation %s after navigation', async (outcome) => {
    const wrapper = await mountArticle()
    await flushPromises()
    const pending = deferred<{ followerCount: number }>()
    mocks.mutate.mockReturnValueOnce(pending.promise)
    wrapper.findComponent(View).vm.$emit('follow')
    article.value = { ...articleFixture('next-article', 'next-author'), followerCount: 20 }
    await flushPromises()
    if (outcome === 'success') pending.resolve({ followerCount: 6 })
    else pending.reject(new Error('Stale failure'))
    await flushPromises()
    expect(article.value.followerCount).toBe(20)
    expect(wrapper.findComponent(View).props('follow').following).toBe(false)
    expect(mocks.toast).not.toHaveBeenCalled()
    expect(mocks.saved).toHaveBeenCalledTimes(outcome === 'success' ? 1 : 0)
    expect(mocks.reverted).toHaveBeenCalledTimes(outcome === 'failure' ? 1 : 0)
  })

  it.each(['author', 'article'])(
    'ignores the %s mutation result after the viewer changes or the view unmounts',
    async (view) => {
      const wrapper = await (view === 'author' ? mountAuthor() : mountArticle())
      await flushPromises()
      const pending = deferred<{ followerCount: number }>()
      mocks.mutate.mockReturnValueOnce(pending.promise)
      if (view === 'author') wrapper.findComponent({ name: 'UButton' }).vm.$emit('click')
      else wrapper.findComponent(View).vm.$emit('follow')
      auth.value = { user: { id: 'another-viewer', role: 'reader' } }
      await flushPromises()
      wrapper.unmount()
      pending.resolve({ followerCount: 42 })
      await flushPromises()
      expect(author.value.followerCount).toBe(5)
      expect(article.value.followerCount).toBe(view === 'article' ? 6 : 5)
      expect(mocks.toast).not.toHaveBeenCalled()
      expect(mocks.saved).toHaveBeenCalledTimes(view === 'article' ? 1 : 0)
      expect(mocks.reverted).not.toHaveBeenCalled()
    },
  )

  it('exposes loading and a keyboard-operable retry action in the article header', async () => {
    const wrapper = await mountSuspended(Hero, {
      props: {
        title: 'Article',
        author: { username: 'author' },
        followerCount: 5,
        isFollowing: false,
        showFollowButton: true,
        followPending: true,
      },
      shallow: true,
      global,
    })
    const button = wrapper.findComponent({ name: 'UButton' })
    expect(button.props('disabled')).toBe(true)
    await wrapper.setProps({ followPending: false, followError: true })
    expect(button.props('disabled')).toBe(false)
    expect(button.props('icon')).toBe('mdi:refresh')
    expect(button.text()).toContain('common.messages.retry')
    button.vm.$emit('click')
    expect(wrapper.emitted('follow')).toHaveLength(1)
  })
})

// @vitest-environment nuxt

import { createI18n } from 'vue-i18n'
import { defineComponent, h } from 'vue'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import type { ArticleCardData } from '../../shared/types/article'

import common from '../../i18n/locales/cs/common.json'
import articles from '../../i18n/locales/cs/articles.json'
import ArticleCard from '../../app/components/Article/Card.vue'
import LikeButton from '../../app/components/Article/LikeButton.vue'
import { useArticleReaction } from '../../app/composables/useArticleReaction'

const mocks = vi.hoisted(() => ({ request: vi.fn(), toast: vi.fn() }))
mockNuxtImport('$fetch', () => mocks.request)
mockNuxtImport('useArticleShare', () => () => vi.fn())
mockNuxtImport('useToast', () => () => ({ add: mocks.toast }))
mockNuxtImport('useOptimisticStatus', () => () => ({ saving: vi.fn(), saved: vi.fn(), reverted: vi.fn() }))
mockNuxtImport(
  'useLocalePath',
  () => () => (route?: string | { name?: string; params?: { slug?: string; name?: string } }) => {
    if (typeof route === 'string') return route
    if (!route) return '/'
    return route.name === 'clanky-slug'
      ? `/clanky/${route.params?.slug}`
      : `/${route.params?.name || route.params?.slug}`
  },
)

const article: ArticleCardData = {
  id: 'article-1',
  slug: 'clanek',
  language: 'cs',
  title: 'Stavební pozemek před koupí',
  imageUrl: null,
  excerpt: 'Prověřte přístup, sítě a smlouvy.',
  createdAt: '2026-10-01T15:01:00Z',
  readingTime: 5,
  views: 345,
  shares: 123,
  likes: 0,
  likedByUser: false,
  author: { id: 'author-1', name: 'Bořek Kazitel' },
  tags: [
    { id: 'tag-1', name: 'Regulace a etika', slug: 'regulace' },
    { id: 'tag-2', name: 'Stavby', slug: 'stavby' },
  ],
  _count: { comments: 0, reactions: 0 },
}

const global = {
  plugins: [createI18n({ legacy: false, locale: 'cs', messages: { cs: { ...common, ...articles } } })],
  stubs: {
    AppMedia: true,
    UserPicture: true,
    UserCard: { props: ['user'], template: '<span>{{ user.username }}</span>' },
  },
}
const mountCard = (data = article) => mountSuspended(ArticleCard, { props: { article: data }, global })

enableAutoUnmount(afterEach)
beforeEach(() => {
  clearNuxtState('article-card-reactions')
  clearNuxtState('article-reaction-pending')
  vi.clearAllMocks()
  mocks.request.mockResolvedValue({ liked: true, likes: 1 })
})

describe('article card engagement', () => {
  it('keeps the compact header control labelled and pressed without a visible count', async () => {
    const wrapper = await mountSuspended(LikeButton, {
      props: { liked: true, likes: 3, iconOnly: true },
      global,
    })
    const button = wrapper.get('button')

    expect(button.attributes('aria-label')).toBe('Lajknout')
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(button.attributes('title')).toBe('Odebrat To se mi líbí')
    expect(button.text()).toBe('')
  })

  it('keeps multiple tags and reading metadata without passive view/share counters or zero counts', async () => {
    const wrapper = await mountCard()

    expect(wrapper.text()).toContain('Regulace a etika')
    expect(wrapper.text()).toContain('Stavby')
    expect(wrapper.text()).toContain('5 min čtení')
    expect(wrapper.text()).toContain('Bořek Kazitel')
    expect(wrapper.text()).not.toContain('17:01')
    expect(wrapper.text()).not.toContain('345')
    expect(wrapper.text()).not.toContain('123')
    const like = wrapper.get('button[aria-pressed]')
    expect(like.text()).toBe('')
    expect(like.attributes('aria-label')).toBe('Lajknout')
    expect(like.attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('a[href="/clanky/clanek#comments"]').exists()).toBe(false)
  })

  it('links a nonzero comment count to the discussion', async () => {
    const wrapper = await mountCard({ ...article, _count: { comments: 2, reactions: 0 } })
    const comments = wrapper.get('a[href="/clanky/clanek#comments"]')

    expect(comments.text()).toBe('')
    expect(comments.attributes('aria-label')).toBe('2 komentáře')
    expect(comments.attributes('title')).toBe('2 komentáře')
  })

  it('shares the actual like state between a card and a detail button', async () => {
    const view = defineComponent({
      setup() {
        const reaction = useArticleReaction(article.id, { liked: false, likes: 0 })
        return () =>
          h('div', [
            h(ArticleCard, { article }),
            h(LikeButton, {
              liked: reaction.liked.value,
              likes: reaction.likes.value,
              pending: reaction.isPending.value,
              onToggle: reaction.toggle,
            }),
          ])
      },
    })
    const wrapper = await mountSuspended(view, { global })
    let resolve!: (value: { liked: boolean; likes: number }) => void
    mocks.request.mockReturnValueOnce(new Promise((done) => (resolve = done)))

    await wrapper.findAll('button[aria-pressed]')[0]!.trigger('click')
    const buttons = wrapper.findAll('button[aria-pressed]')
    expect(buttons.map((button) => button.attributes('aria-pressed'))).toEqual(['true', 'true'])
    expect(buttons.every((button) => button.attributes('disabled') !== undefined)).toBe(true)
    expect(buttons[0]!.text()).toBe('')
    expect(buttons[1]!.text()).toContain('1')
    expect(mocks.request).toHaveBeenCalledExactlyOnceWith('/api/articles/article-1/reaction', { method: 'POST' })

    resolve({ liked: true, likes: 1 })
    await flushPromises()
    mocks.request.mockResolvedValueOnce({ liked: false, likes: 0 })
    await buttons[1]!.trigger('click')
    await flushPromises()

    expect(buttons.map((button) => button.attributes('aria-pressed'))).toEqual(['false', 'false'])
    expect(buttons[0]!.text()).toBe('')
    expect(buttons[1]!.text()).toBe('Lajknout')
  })

  it('restores the button and count when a like fails', async () => {
    mocks.request.mockRejectedValueOnce(new Error('Offline'))
    const wrapper = await mountCard()

    await wrapper.get('button[aria-pressed]').trigger('click')
    await flushPromises()

    expect(wrapper.get('button[aria-pressed]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('button[aria-pressed]').text()).toBe('')
    expect(wrapper.get('button[aria-pressed]').attributes('aria-label')).toBe('Lajknout')
    expect(mocks.toast).toHaveBeenCalledOnce()
  })
})

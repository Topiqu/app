// @vitest-environment nuxt

import { ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import common from '../../i18n/locales/cs/common.json'
import articles from '../../i18n/locales/cs/articles.json'
import Discussions from '../../app/components/Home/Discussions.vue'

const mocks = vi.hoisted(() => ({ gifUrl: null as string | null, empty: false }))
mockNuxtImport('useLazyFetch', () => () => ({
  data: ref(
    mocks.empty
      ? []
      : [
          {
            id: 'comment-1',
            content: '[reader](reader) Komentář',
            gifUrl: mocks.gifUrl,
            createdAt: '2026-10-24T09:00:00Z',
            user: { username: 'Čtenář', avatarUrl: null },
            article: { slug: 'clanek', title: 'Článek', language: 'cs', comments: 2 },
          },
        ],
  ),
}))
mockNuxtImport('useLocalePath', () => () => () => '/clanky/clanek')

const mount = () =>
  mountSuspended(Discussions, {
    props: { site: 'blog' },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'cs', messages: { cs: { ...common, ...articles } } })],
      stubs: { NuxtImg: true, UserPicture: true },
    },
  })

enableAutoUnmount(afterEach)
beforeEach(() => {
  mocks.gifUrl = null
  mocks.empty = false
})

describe('homepage discussion previews', () => {
  it('shows a saved GIF while retaining mentions and the discussion link', async () => {
    mocks.gifUrl = 'https://media.giphy.com/media/discussion/giphy.gif'
    const wrapper = await mount()

    expect(wrapper.get('[alt="GIF"]').attributes('src')).toBe('https://media.giphy.com/media/discussion/giphy.webp')
    expect(wrapper.text()).toContain('[reader](reader) Komentář')
    expect(wrapper.get('a').attributes('href')).toBe('/clanky/clanek#comments')
  })

  it('does not reserve a GIF placeholder for text-only comments', async () => {
    const wrapper = await mount()
    expect(wrapper.find('[alt="GIF"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('[reader](reader) Komentář')
  })

  it('omits the section when no discussions are available', async () => {
    mocks.empty = true
    expect((await mount()).find('section').exists()).toBe(false)
  })
})

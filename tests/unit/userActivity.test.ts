// @vitest-environment nuxt
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import common from '../../i18n/locales/cs/common.json'
import articles from '../../i18n/locales/cs/articles.json'
import UserActivity from '../../app/components/User/Activity.vue'

const mocks = vi.hoisted(() => ({ error: null as null | { message: string }, refresh: vi.fn() }))
mockNuxtImport('useFetch', () => () => ({
  data: ref({ likedArticles: [], comments: [], hasMore: { likedArticles: false, comments: false } }),
  pending: ref(false),
  error: ref(mocks.error),
  refresh: mocks.refresh,
}))
mockNuxtImport('useArticleShare', () => () => vi.fn())
mockNuxtImport('useLocalePath', () => () => () => '/')
mockNuxtImport('useToast', () => () => ({ add: vi.fn() }))
mockNuxtImport('useConfirm', () => () => vi.fn())

enableAutoUnmount(afterEach)

const mount = (activeTab: 'likedArticles' | 'comments' = 'likedArticles') =>
  mountSuspended(UserActivity, {
    props: { activeTab },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'cs', messages: { cs: { ...articles, ...common } } })],
      stubs: { NuxtImg: true },
    },
  })

describe('user activity empty and error states', () => {
  beforeEach(() => {
    mocks.error = null
    mocks.refresh.mockReset()
  })

  it('shows the article empty state for a successful empty response', async () => {
    const wrapper = await mount()
    expect(wrapper.text()).toContain('Zatím nemáte žádné oblíbené články')
    expect(wrapper.text()).not.toContain('Data se nepodařilo načíst.')
  }, 15000)

  it('uses the comment empty state in the comments tab', async () => {
    const wrapper = await mount('comments')
    expect(wrapper.text()).toContain('Žádné komentáře')
    expect(wrapper.text()).not.toContain('Zatím nemáte žádné oblíbené články')
  })

  it('offers retry without exposing the raw API error', async () => {
    mocks.error = { message: '[GET] /api/users/activity: 500 Internal Server Error' }
    const wrapper = await mount()
    expect(wrapper.text()).toContain('Data se nepodařilo načíst. Zkuste to prosím znovu.')
    expect(wrapper.text()).not.toContain('/api/users/activity')
    expect(wrapper.text()).not.toContain('500')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Zkusit znovu')!
      .trigger('click')
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })
})

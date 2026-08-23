// @vitest-environment nuxt

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

import ArticleParsed from '../../app/components/Article/Parsed.vue'

mockNuxtImport(
  'useImage',
  () => () => (src: string, options: { width: number }) => `/optimized/${options.width}/${src}`,
)
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))

describe('ArticleParsed inline image recovery', () => {
  it('tries the original once and then replaces the failed image with an accessible compact fallback', async () => {
    const wrapper = mount(ArticleParsed, {
      props: {
        articleId: 'article-1',
        blocks: [
          {
            type: 'html',
            html: '<p><img src="https://cdn.example/original.jpg" alt="Editorial diagram"></p>',
          },
        ],
      },
      global: {
        mocks: { $t: (key: string) => key },
        stubs: { ArticlePoll: true },
      },
    })

    const optimized = wrapper.get('img')
    expect(optimized.attributes('data-original-src')).toBe('https://cdn.example/original.jpg')

    await optimized.trigger('error')
    const retried = wrapper.get('img')
    expect(retried.attributes('src')).toContain('https://cdn.example/original.jpg')
    expect(retried.attributes('srcset')).toBeUndefined()
    expect(retried.attributes('data-original-retry')).toBe('true')

    await retried.trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    const fallback = wrapper.get('.article-inline-image-fallback')
    expect(fallback.attributes('role')).toBe('img')
    expect(fallback.attributes('aria-label')).toBe('Editorial diagram')
    expect(fallback.text()).toBe('Editorial diagram')
  })
})

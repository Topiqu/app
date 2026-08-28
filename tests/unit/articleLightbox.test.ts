// @vitest-environment nuxt

import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import ArticleLightbox from '../../app/components/Article/Lightbox.vue'

describe('ArticleLightbox', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('opens published article images without requiring the removed prose class', async () => {
    const source = document.createElement('article')
    source.className = 'article-content'
    source.innerHTML = '<p><img src="/inline-image.webp" alt="Code design"></p>'
    document.body.append(source)

    const wrapper = mount(ArticleLightbox, {
      props: { sourceRef: source },
      global: {
        stubs: {
          VueEasyLightbox: {
            name: 'VueEasyLightbox',
            props: ['visible', 'imgs', 'index'],
            template: '<div data-lightbox />',
          },
        },
      },
    })

    await nextTick()
    source.querySelector('img')!.click()
    await nextTick()

    const lightbox = wrapper.getComponent({ name: 'VueEasyLightbox' })
    expect(lightbox.props('visible')).toBe(true)
    expect(lightbox.props('index')).toBe(0)
    expect(lightbox.props('imgs')).toEqual([
      { src: new URL('/inline-image.webp', window.location.href).href, title: 'Code design' },
    ])

    wrapper.unmount()
  })
})

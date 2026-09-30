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
    source.innerHTML = '<p><img src="/inline-image.webp" data-article-lightbox="true" alt="Code design"></p>'
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

  it('keeps a responsive image clickable when currentSrc changes after collection', async () => {
    const source = document.createElement('article')
    source.innerHTML = '<p><img src="/original.webp" data-article-lightbox="true" alt="Responsive"></p>'
    document.body.append(source)
    const image = source.querySelector('img')!

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
    image.setAttribute('src', '/optimized-1024.webp')
    image.click()
    await nextTick()

    expect(wrapper.getComponent({ name: 'VueEasyLightbox' }).props('visible')).toBe(true)
    wrapper.unmount()
  })

  it('leaves a linked figure image to its link', async () => {
    const source = document.createElement('article')
    source.innerHTML =
      '<figure class="article-image"><a href="#target"><img src="/linked.webp" data-article-lightbox="true" alt="Linked"></a></figure>' +
      '<figure class="article-image"><img src="/zoom.webp" data-article-lightbox="true" alt="Zoom"></figure>'
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
    const lightbox = wrapper.getComponent({ name: 'VueEasyLightbox' })
    source.querySelector<HTMLImageElement>('img[alt="Linked"]')!.click()
    await nextTick()
    expect(lightbox.props('visible')).toBe(false)
    expect(lightbox.props('imgs')).toHaveLength(1)

    source.querySelector<HTMLImageElement>('img[alt="Zoom"]')!.click()
    await nextTick()
    expect(lightbox.props('visible')).toBe(true)
    expect(lightbox.props('index')).toBe(0)
    wrapper.unmount()
  })
})

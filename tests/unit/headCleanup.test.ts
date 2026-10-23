// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createHead, renderDOMHead } from 'unhead/client'

describe('head DOM cleanup ownership', () => {
  it('consumes removed meta/link cleanup once, including after a document change', () => {
    const original = document.implementation.createHTMLDocument('Original')
    const replacement = document.implementation.createHTMLDocument('Replacement')
    const head = createHead({ document: original })
    head.push({ meta: [{ name: 'viewport', content: 'width=device-width' }] })
    const article = head.push({
      meta: [{ property: 'og:image', content: '/article.png' }],
      link: [{ rel: 'canonical', href: 'https://fixture.test/article' }],
    })
    const image = original.querySelector('meta[property="og:image"]')!
    const canonical = original.querySelector('link[rel="canonical"]')!
    const removeImage = vi.spyOn(image, 'remove')
    const removeCanonical = vi.spyOn(canonical, 'remove')

    article.dispose()
    expect(original.querySelector('meta[property="og:image"]')).toBeNull()
    expect(original.querySelector('link[rel="canonical"]')).toBeNull()
    expect(removeImage).toHaveBeenCalledTimes(1)
    expect(removeCanonical).toHaveBeenCalledTimes(1)

    renderDOMHead(head, { document: replacement })
    expect(replacement.querySelector('meta[name="viewport"]')?.getAttribute('content')).toBe('width=device-width')
    expect(removeImage).toHaveBeenCalledTimes(1)
    expect(removeCanonical).toHaveBeenCalledTimes(1)
  })

  it('preserves replacement attributes, title and event cleanup', () => {
    const dom = document.implementation.createHTMLDocument('Original')
    const head = createHead({ document: dom })
    const firstLoad = vi.fn()
    const secondLoad = vi.fn()
    const entry = head.push({
      title: 'First article',
      bodyAttrs: { class: 'article-first', style: '--article-color: red' },
      script: [{ src: '/fixture.js', onload: firstLoad }],
    })
    const script = dom.querySelector('script')!
    script.dispatchEvent(new Event('load'))
    expect(firstLoad).toHaveBeenCalledTimes(1)

    entry.patch({
      title: 'Second article',
      bodyAttrs: { class: 'article-second', style: '--article-color: blue' },
      script: [{ src: '/fixture.js', onload: secondLoad }],
    })
    expect(dom.title).toBe('Second article')
    expect(dom.body.className).toBe('article-second')
    expect(dom.body.style.getPropertyValue('--article-color')).toBe('blue')
    script.dispatchEvent(new Event('load'))
    expect(firstLoad).toHaveBeenCalledTimes(1)
    expect(secondLoad).toHaveBeenCalledTimes(1)

    entry.dispose()
    expect(dom.title).toBe('Original')
    expect(dom.body.className).toBe('')
    expect(dom.body.style.getPropertyValue('--article-color')).toBe('')
    expect(dom.querySelector('script')).toBeNull()
    script.dispatchEvent(new Event('load'))
    expect(secondLoad).toHaveBeenCalledTimes(1)
  })
})

import { describe, expect, it } from 'vitest'

import { articleBlocks } from '../../server/utils/articleBlocks'
import { stripContentSlots } from '../../shared/utils/contentSlots'
import { contentToMarkdown } from '../../server/utils/articleMarkdown'
import {
  ctaHtml,
  ctaUrl,
  findXPostUrls,
  parseXPostUrl,
  productCardHtml,
  readCta,
  xPostDate,
  xPostHtml,
} from '../../shared/utils/articleEmbeds'

const card = { productId: 'p1', url: 'https://shop.test/ryc?a=1&b=2', name: 'Rýč "Pro" <XL>' }
const post = {
  url: 'https://x.com/topiqu/status/1585841080431321088',
  author: 'Topiqu & co',
  handle: 'topiqu',
  text: 'První řádek\ndruhý <b>řádek</b>\n\nDalší odstavec',
  date: '2022-10-28T03:49:11.734Z',
  media: true,
}

describe('product cards', () => {
  it('stores a reference whose escaped inner link is the fallback', () => {
    expect(productCardHtml(card)).toBe(
      '<div data-type="product" data-product-id="p1" data-url="https://shop.test/ryc?a=1&amp;b=2" data-name="Rýč &quot;Pro&quot; &lt;XL&gt;"><p><a href="https://shop.test/ryc?a=1&amp;b=2">Rýč "Pro" &lt;XL&gt;</a></p></div>',
    )
  })

  it('renders as its own block with the stamped live facts', () => {
    const stamped = productCardHtml(card).replace(
      '<div data-type="product"',
      '<div data-type="product" data-price="1290.00" data-currency="CZK" data-availability="IN_STOCK" data-image="https://cdn.test/p1.webp"',
    )
    const { blocks } = articleBlocks(`<p>Úvod</p>${stamped}<p>Závěr</p>`)
    expect(blocks.map(({ type }) => type)).toEqual(['html', 'product', 'html'])
    expect(blocks[1]).toEqual({
      type: 'product',
      product: {
        ...card,
        price: '1290.00',
        currency: 'CZK',
        availability: 'IN_STOCK',
        imageUrl: 'https://cdn.test/p1.webp',
      },
    })
  })

  it('stays plain HTML when its link is not https', () => {
    const html = productCardHtml({ ...card, url: 'javascript:alert(1)' })
    expect(articleBlocks(html).blocks.map(({ type }) => type)).toEqual(['html'])
  })

  it('flattens to its link in Markdown exports', () => {
    expect(contentToMarkdown(productCardHtml({ ...card, name: 'Rýč' }))).toBe('[Rýč](https://shop.test/ryc?a=1&b=2)')
  })
})

describe('X posts', () => {
  it('accepts one post on x.com or twitter.com and canonicalises it', () => {
    for (const url of [
      'https://twitter.com/topiqu/status/123?s=20',
      'https://mobile.x.com/topiqu/status/123/',
      'https://www.x.com/topiqu/statuses/123#m',
    ])
      expect(parseXPostUrl(url)).toEqual({ handle: 'topiqu', id: '123', url: 'https://x.com/topiqu/status/123' })

    for (const url of [
      'http://x.com/topiqu/status/123',
      'https://x.com.evil.test/topiqu/status/123',
      'https://x.com/topiqu',
      'https://x.com/topiqu/status/123/photo/1',
      'https://user@x.com/topiqu/status/123',
    ])
      expect(parseXPostUrl(url)).toBeNull()
  })

  it('reads the post time from its id', () => {
    expect(xPostDate('1585841080431321088')).toBe('2022-10-28T03:49:11.734Z')
    // Ids before the 2010 switch carry no timestamp.
    expect(xPostDate('20')).toBeNull()
  })

  it('finds only post URLs that appear in a text, once each', () => {
    expect(
      findXPostUrls(
        'Viz https://twitter.com/topiqu/status/1 a https://x.com/topiqu/status/1?s=20, https://x.com/topiqu a https://x.com/b/status/2',
      ),
    ).toEqual(['https://x.com/topiqu/status/1', 'https://x.com/b/status/2'])
    expect(findXPostUrls(null)).toEqual([])
  })

  it('stores a static quote and renders it back as a post block', () => {
    const html = xPostHtml(post)
    expect(html).not.toContain('<script')
    expect(html).toContain('<p>První řádek<br>druhý &lt;b&gt;řádek&lt;/b&gt;</p><p>Další odstavec</p>')
    expect(html).toContain(
      '<p>— <a href="https://x.com/topiqu/status/1585841080431321088">Topiqu &amp; co (@topiqu)</a></p>',
    )

    const { blocks } = articleBlocks(html)
    expect(blocks).toEqual([{ type: 'xPost', post }])
  })

  it('drops a post with an invalid URL back to its quote', () => {
    const html = xPostHtml(post).replace(post.url, 'https://evil.test/topiqu/status/1')
    expect(articleBlocks(html).blocks.map(({ type }) => type)).toEqual(['html'])
  })

  it('never leaves an unfilled slot in the body', () => {
    expect(stripContentSlots('<p>a</p>[[XPOST1]]<p>b</p>')).toBe('<p>a</p><p>b</p>')
  })
})

describe('call to action', () => {
  it('accepts https links and paths on the site only', () => {
    expect(ctaUrl(' https://firma.test/kontakt ')).toBe('https://firma.test/kontakt')
    expect(ctaUrl('/kontakt')).toBe('/kontakt')
    for (const url of [
      '//evil.test',
      '/\\evil.test',
      'http://firma.test',
      'javascript:alert(1)',
      'https://u:p@firma.test',
      '',
      null,
    ])
      expect(ctaUrl(url)).toBeNull()
  })

  it('round-trips its fields through the stored attributes', () => {
    const cta = { title: 'Nadpis "x" & y', text: '', label: 'Kontakt', url: '/kontakt', tone: 'accent' as const }
    const html = ctaHtml(cta)
    expect(html).not.toContain('<p></p>')
    const element = new DOMParser().parseFromString(html, 'text/html').body.firstElementChild!
    expect(readCta((name) => element.getAttribute(name))).toEqual(cta)
  })

  it('refuses a block without a usable link and repairs an unknown tone', () => {
    const attrs = (overrides: Record<string, string>) => (name: string) =>
      ({ 'data-title': 'T', 'data-label': 'L', 'data-url': '/x', 'data-tone': 'loud', ...overrides })[name] ?? null
    expect(readCta(attrs({ 'data-url': 'http://x.test' }))).toBeNull()
    expect(readCta(attrs({ 'data-label': ' ' }))).toBeNull()
    expect(readCta(attrs({}))?.tone).toBe('accent')
  })
})

describe('body blocks in Markdown exports', () => {
  it('flattens a CTA to its heading, text and link', () => {
    const html = ctaHtml({ title: 'Poradíme', text: 'Ozvěte se.', label: 'Kontakt', url: '/kontakt', tone: 'accent' })
    expect(contentToMarkdown(html)).toBe('**Poradíme**\n\nOzvěte se.\n\n[Kontakt](/kontakt)')
  })

  it('keeps the paragraphs of a callout and the labels of pros and cons', () => {
    expect(contentToMarkdown('<aside data-type="callout" data-tone="tip"><p>Jedna.</p><p>Dvě.</p></aside>')).toBe(
      'Jedna.\n\nDvě.',
    )
    expect(
      contentToMarkdown(
        '<div data-type="pros-cons"><div data-side="pros"><p>Výhody</p><ul><li><p>A</p></li></ul></div>' +
          '<div data-side="cons"><p>Nevýhody</p><ul><li><p>B</p></li></ul></div></div>',
      ),
    ).toBe('Výhody\n\n- A\n\nNevýhody\n\n- B')
  })
})

import { describe, expect, it } from 'vitest'

import { articleBlocks } from '../../server/utils/articleBlocks'
import { stripContentSlots } from '../../shared/utils/contentSlots'
import { contentToMarkdown } from '../../server/utils/articleMarkdown'
import { findXPostUrls, parseXPostUrl, productCardHtml, xPostDate, xPostHtml } from '../../shared/utils/articleEmbeds'

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

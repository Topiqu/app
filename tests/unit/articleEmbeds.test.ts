import { describe, expect, it } from 'vitest'

import { articleBlocks } from '../../server/utils/articleBlocks'
import { productCardHtml } from '../../shared/utils/articleEmbeds'
import { contentToMarkdown } from '../../server/utils/articleMarkdown'

const card = { productId: 'p1', url: 'https://shop.test/ryc?a=1&b=2', name: 'Rýč "Pro" <XL>' }

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

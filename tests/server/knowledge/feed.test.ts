import { describe, expect, it } from 'vitest'

import {
  collectFeedProducts,
  parseKnowledgeFeed,
  parsePrice,
  plainText,
  productUrl,
} from '../../../server/utils/knowledge/feed'

const heureka = `<?xml version="1.0" encoding="utf-8"?>
<SHOP>
  <SHOPITEM>
    <ITEM_ID>tee-s</ITEM_ID>
    <ITEMGROUP_ID>tee</ITEMGROUP_ID>
    <PRODUCTNAME>Tričko Basic</PRODUCTNAME>
    <DESCRIPTION><![CDATA[<p>Bavlněné tričko.</p><p>Pere se na 40&nbsp;°C.</p>]]></DESCRIPTION>
    <URL>https://shop.example.cz/tricko?utm_source=heureka&amp;barva=modra#top</URL>
    <PRICE_VAT>399</PRICE_VAT>
    <MANUFACTURER>Acme</MANUFACTURER>
    <CATEGORYTEXT>Oblečení | Trička</CATEGORYTEXT>
    <DELIVERY_DATE>5</DELIVERY_DATE>
    <PARAM><PARAM_NAME>Velikost</PARAM_NAME><VAL>S</VAL></PARAM>
  </SHOPITEM>
  <SHOPITEM>
    <ITEM_ID>tee-m</ITEM_ID>
    <ITEMGROUP_ID>tee</ITEMGROUP_ID>
    <PRODUCTNAME>Tričko Basic</PRODUCTNAME>
    <URL>https://shop.example.cz/tricko-m</URL>
    <PRICE_VAT>349,50</PRICE_VAT>
    <DELIVERY_DATE>0</DELIVERY_DATE>
    <PARAM><PARAM_NAME>Velikost</PARAM_NAME><VAL>M</VAL></PARAM>
  </SHOPITEM>
  <SHOPITEM>
    <ITEM_ID>mug</ITEM_ID>
    <PRODUCTNAME>Hrnek</PRODUCTNAME>
    <URL>http://shop.example.cz/hrnek</URL>
    <PRICE_VAT>199</PRICE_VAT>
  </SHOPITEM>
  <SHOPITEM>
    <ITEM_ID>nameless</ITEM_ID>
    <URL>https://shop.example.cz/nameless</URL>
  </SHOPITEM>
</SHOP>`

const google = `<?xml version="1.0"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Shop</title>
    <item>
      <g:id>KNIFE-1</g:id>
      <title>Chef knife &amp; sheath</title>
      <link>https://shop.example.com/knife?gclid=abc&amp;ref=feed</link>
      <g:price>1,299.00 USD</g:price>
      <g:availability>out of stock</g:availability>
      <g:product_type>Home &gt; Kitchen</g:product_type>
      <g:product_detail>
        <g:attribute_name>Blade</g:attribute_name>
        <g:attribute_value>20 cm</g:attribute_value>
      </g:product_detail>
    </item>
  </channel>
</rss>`

const atom = `<feed xmlns="http://www.w3.org/2005/Atom" xmlns:g="http://base.google.com/ns/1.0">
  <entry>
    <g:id>BOARD</g:id>
    <title>Cutting board</title>
    <link href="https://shop.example.com/board" />
    <g:price>45.5 EUR</g:price>
    <g:availability>preorder</g:availability>
  </entry>
</feed>`

describe('knowledge product feeds', () => {
  it('merges Heureka variants and reports what it skipped', () => {
    const { products, report } = collectFeedProducts(parseKnowledgeFeed(heureka, 'CZK'), 100)

    expect(report).toEqual({ items: 4, products: 1, skipped: { url: 1, name: 1 }, unpriced: 0, truncated: 0 })
    expect(products[0]).toMatchObject({
      externalId: 'tee',
      name: 'Tričko Basic',
      // The in-stock variant's link, not the first variant's.
      url: 'https://shop.example.cz/tricko-m',
      price: '349.50',
      currency: 'CZK',
      availability: 'IN_STOCK',
    })
    expect(products[0]!.text).toBe(
      'Tričko Basic\nBrand: Acme\nCategory: Oblečení › Trička\nVelikost: S, M\nBavlněné tričko. Pere se na 40 °C.',
    )
  })

  it('reads Google Merchant RSS and Atom, including core elements and link attributes', () => {
    const { products, report } = collectFeedProducts(parseKnowledgeFeed(google, null), 100)
    expect(products[0]).toMatchObject({
      externalId: 'KNIFE-1',
      name: 'Chef knife & sheath',
      url: 'https://shop.example.com/knife?ref=feed',
      availability: 'OUT_OF_STOCK',
      // "1,299.00" is ambiguous across locales, so no price rather than a wrong one.
      price: null,
      currency: null,
    })
    expect(products[0]!.text).toContain('Category: Home › Kitchen\nBlade: 20 cm')
    expect(report.unpriced).toBe(1)

    const [board] = collectFeedProducts(parseKnowledgeFeed(atom, null), 100).products
    expect(board).toMatchObject({
      url: 'https://shop.example.com/board',
      price: '45.50',
      currency: 'EUR',
      availability: 'PREORDER',
    })
  })

  it('never expands DTD entities', () => {
    const bomb = `<?xml version="1.0"?>
<!DOCTYPE SHOP [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;">]>
<SHOP><SHOPITEM><ITEM_ID>1</ITEM_ID><PRODUCTNAME>A &lol2; B</PRODUCTNAME><URL>https://shop.example.cz/a</URL></SHOPITEM></SHOP>`
    const [product] = collectFeedProducts(parseKnowledgeFeed(bomb, 'CZK'), 100).products
    expect(product!.name).not.toContain('lollol')
  })

  it('caps products at the quota and keeps the text hash independent of price', () => {
    const cheaper = heureka.replace('<PRICE_VAT>349,50</PRICE_VAT>', '<PRICE_VAT>299</PRICE_VAT>')
    const before = collectFeedProducts(parseKnowledgeFeed(heureka, 'CZK'), 100)
    const after = collectFeedProducts(parseKnowledgeFeed(cheaper, 'CZK'), 100)

    expect(after.products[0]!.textHash).toBe(before.products[0]!.textHash)
    expect(after.hash).not.toBe(before.hash)
    expect(collectFeedProducts(parseKnowledgeFeed(heureka, 'CZK'), 100).hash).toBe(before.hash)

    const capped = collectFeedProducts(parseKnowledgeFeed(heureka, 'CZK'), 0)
    expect(capped.report).toMatchObject({ products: 0, truncated: 1 })
  })

  it('drops a price whose currency is not ISO 4217', () => {
    const { products, report } = collectFeedProducts(parseKnowledgeFeed(heureka, 'XYZ'), 100)
    expect(products[0]).toMatchObject({ price: null, currency: null })
    expect(report.unpriced).toBe(1)
  })

  it('parses only unambiguous prices', () => {
    expect(parsePrice('1299')).toBe('1299.00')
    expect(parsePrice('1 299,5')).toBe('1299.50')
    expect(parsePrice('1\u00A0299.90')).toBe('1299.90')
    expect(parsePrice('1.299,00')).toBeNull()
    expect(parsePrice('12.345')).toBeNull()
    expect(parsePrice('free')).toBeNull()
  })

  it('keeps product links https, credential-free and without tracking', () => {
    expect(productUrl('https://shop.test/p?utm_medium=x&fbclid=1&size=m')).toBe('https://shop.test/p?size=m')
    expect(productUrl('http://shop.test/p')).toBeNull()
    expect(productUrl('https://user:pass@shop.test/p')).toBeNull()
    expect(productUrl('javascript:alert(1)')).toBeNull()
  })

  it('turns HTML descriptions into plain text', () => {
    expect(plainText('<ul><li>One</li><li>Two</li></ul>', 100)).toBe('One Two')
    expect(plainText('a'.repeat(50), 10)).toHaveLength(10)
  })
})

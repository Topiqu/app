import { describe, expect, it } from 'vitest'

import { exportShopifyContent, shopifyHandle, type ShopifyArticleContent } from '../../../server/utils/shopify/content'

const article = (): ShopifyArticleContent => ({
  id: 'article-1',
  slug: 'article',
  title: 'Title',
  excerpt: 'Summary',
  content: '<p>Hello</p>',
  imageUrl: null,
  imageCredit: null,
  answer: null,
  keyTakeaways: [],
  faq: [],
  sources: [],
  tags: [],
})

describe('Shopify article export', () => {
  it('keeps tables and media credits, drops interactive elements, and resolves links', () => {
    const html = exportShopifyContent(
      {
        ...article(),
        content:
          '<p class="prose" data-editor="true"><a href="/en/article">Link</a></p><table><tr><td>A</td></tr></table><img src="/image.jpg" data-media-id="secret"><small>Photo: Artist</small><div data-type="poll"><button>Vote</button></div><script>alert(1)</script><form><input></form>',
      },
      'https://tenant.example',
      'en',
    )
    expect(html).toContain('href="https://tenant.example/en/article"')
    expect(html).toContain('src="https://tenant.example/image.jpg"')
    expect(html).toContain('<td>A</td>')
    expect(html).toContain('Photo: Artist')
    expect(html).not.toMatch(/data-|class=|<script|<button|<form|<input|Vote/)
  })

  it('exports the answer, takeaways, FAQ, sources and cover attribution in the article language', () => {
    const html = exportShopifyContent(
      {
        ...article(),
        answer: '<Answer>',
        keyTakeaways: ['<Takeaway>'],
        faq: [{ question: '<Question>', answer: '<Response>' }],
        sources: ['https://source.test/page', 'javascript:alert(1)'],
        imageCredit: {
          kind: 'photo',
          credit: { author: 'Artist', source: 'Library', license: 'CC BY', licenseUrl: 'https://license.test' },
        },
      },
      'https://tenant.example',
      'cs',
    )
    expect(html).toContain('&lt;Answer&gt;')
    expect(html).toContain('Hlavní body')
    expect(html).toContain('Časté otázky')
    expect(html).toContain('&lt;Question&gt;')
    expect(html).toContain('Zdroje')
    expect(html).toContain('Foto: Artist')
    expect(html).toContain('CC BY')
    expect(html).not.toContain('javascript:')
  })

  it('discloses a generated cover and rejects unsafe links and images', () => {
    const html = exportShopifyContent(
      {
        ...article(),
        imageCredit: { kind: 'ai' },
        content: '<a href="javascript:alert(1)">x</a><img src="http://unsafe.test/x" onerror="alert(1)">',
      },
      'https://tenant.example',
      'en',
    )
    expect(html).toContain('AI-generated illustration')
    expect(html).not.toMatch(/javascript:|onerror|http:\/\/unsafe/)
  })

  it('gives different articles distinct deterministic handles and bounds their length', () => {
    expect(shopifyHandle('title', 'one')).toBe(shopifyHandle('title', 'one'))
    expect(shopifyHandle('title', 'one')).not.toBe(shopifyHandle('title', 'two'))
    expect(shopifyHandle('a'.repeat(200), 'one').length).toBeLessThan(100)
    expect(shopifyHandle('title OR malicious:*', 'one')).toMatch(/^[a-z0-9-]+$/)
  })
})

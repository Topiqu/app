import { describe, expect, it } from 'vitest'

import { optimizeArticleImages } from '../../shared/utils/articleImages'

describe('optimizeArticleImages', () => {
  it('keeps the direct source and adds deferred loading hints', () => {
    const html = optimizeArticleImages('<p><img src="https://cdn.example/image.png?a=1&amp;b=2" alt="Preview"></p>')

    expect(html).toContain('src="https://cdn.example/image.png?a=1&amp;b=2"')
    expect(html).not.toContain('srcset=')
    expect(html).toContain('loading="lazy" decoding="async"')
    expect(html).toContain('data-original-src="https://cdn.example/image.png?a=1&amp;b=2"')
    expect(html).toContain('alt="Preview"')
  })

  it('keeps existing image attributes and ignores markup without a source', () => {
    const html = optimizeArticleImages('<img src="/image.jpg" width="400" loading="eager"><img alt="x">')

    expect(html).toContain('width="400" loading="eager"')
    expect(html).not.toContain('width="400" loading="eager" width=')
    expect(html).toContain('<img alt="x">')
  })
})

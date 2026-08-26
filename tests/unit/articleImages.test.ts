import { describe, expect, it } from 'vitest'

import { optimizeArticleImages } from '../../shared/utils/articleImages'

describe('optimizeArticleImages', () => {
  it('adds responsive variants and retains the direct source as a fallback', () => {
    const html = optimizeArticleImages(
      '<p><img src="https://cdn.example/image.png?a=1&amp;b=2" alt="Preview"></p>',
      (source, width) => `/_ipx/f_webp&q_82&w_${width}/${source}`,
    )

    expect(html).toContain('src="/_ipx/f_webp&amp;q_82&amp;w_1024/https://cdn.example/image.png?a=1&amp;b=2"')
    expect(html).toContain('srcset="/_ipx/f_webp&amp;q_82&amp;w_480/')
    expect(html).toContain(' 480w, ')
    expect(html).toContain(' 768w, ')
    expect(html).toContain(' 1024w"')
    expect(html).toContain('sizes="(min-width: 768px) 68ch, calc(100vw - 2rem)"')
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

  it('does not fabricate responsive candidates for an unsupported source', () => {
    const html = optimizeArticleImages('<img src="https://external.example/image.jpg">', () => null)

    expect(html).toContain('src="https://external.example/image.jpg"')
    expect(html).not.toContain('srcset=')
  })
})

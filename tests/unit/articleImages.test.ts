import { describe, expect, it, vi } from 'vitest'

import { optimizeArticleImages } from '../../shared/utils/articleImages'

describe('optimizeArticleImages', () => {
  it('adds responsive optimized sources, dimensions and deferred decoding', () => {
    const resolve = vi.fn((src: string, width: number) => `/_ipx/w_${width}/${src}?a=1&b=2`)
    const html = optimizeArticleImages('<p><img src="https://cdn.example/image.png" alt="Preview"></p>', resolve)

    expect(resolve).toHaveBeenCalledTimes(2)
    expect(html).toContain('src="/_ipx/w_1000/https://cdn.example/image.png?a=1&amp;b=2"')
    expect(html).toContain('srcset="/_ipx/w_640/https://cdn.example/image.png?a=1&amp;b=2 640w')
    expect(html).toContain('width="1000" height="667" loading="lazy" decoding="async"')
    expect(html).toContain('alt="Preview"')
  })

  it('keeps existing image attributes and ignores markup without a source', () => {
    const resolve = (src: string, width: number) => `${src}?w=${width}`
    const html = optimizeArticleImages('<img src="/image.jpg" width="400" loading="eager"><img alt="x">', resolve)

    expect(html).toContain('width="400" loading="eager"')
    expect(html).not.toContain('width="400" loading="eager" width=')
    expect(html).toContain('<img alt="x">')
  })
})

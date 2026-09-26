import { describe, expect, it } from 'vitest'

import { sameSitePages, sitemapLocations } from '../../../server/utils/knowledge/sitemap'

describe('sitemap discovery', () => {
  it('reads plain and CDATA locations and decodes entities', () => {
    const xml = `<?xml version="1.0"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/pricing</loc></url>
        <url><loc><![CDATA[https://example.com/blog?a=1&b=2]]></loc></url>
        <url><loc> https://example.com/search?q=x&amp;page=2 </loc></url>
      </urlset>`
    expect(sitemapLocations(xml)).toEqual([
      'https://example.com/pricing',
      'https://example.com/blog?a=1&b=2',
      'https://example.com/search?q=x&page=2',
    ])
  })

  it('keeps only https pages of the same site, deduplicated and without fragments', () => {
    const pages = sameSitePages(
      [
        'https://example.com/a',
        'https://www.example.com/b',
        'https://example.com/a#section',
        'http://example.com/insecure',
        'https://evil.test/c',
        'https://example.com.evil.test/d',
        'not a url',
      ],
      new URL('https://example.com/sitemap.xml'),
    )
    expect(pages).toEqual(['https://example.com/a', 'https://www.example.com/b'])
  })
})

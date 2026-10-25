import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/images/publicFetch'), 'fetchPublicUrl', 'readLimitedBody')
  await stubNitroImports(import('../../../server/utils/knowledge/extract'), 'KnowledgeExtractError')
}

await stubImports()

const { discoverSitemapPages, sameSitePages, sitemapLocations } =
  await import('../../../server/utils/knowledge/sitemap')

const serve = (files: Record<string, string | number | Error>) => {
  const fetch = vi.fn<typeof import('../../../server/utils/images/publicFetch').fetchPublicUrl>(async (url) => {
    const content = files[url.toString()] ?? 404
    if (content instanceof Error) throw content
    return new Response(typeof content === 'string' ? content : null, {
      status: typeof content === 'number' ? content : 200,
    })
  })
  vi.stubGlobal('fetchPublicUrl', fetch)
  return fetch
}

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

  it('discovers a canonical-host sitemap index from robots.txt for a www site address', async () => {
    const fetch = serve({
      'https://www.example.com/robots.txt': 'User-agent: *\nSitemap: https://example.com/sitemap_index.xml\n',
      'https://example.com/sitemap_index.xml':
        '<sitemapindex><sitemap><loc>https://example.com/page-sitemap.xml</loc></sitemap></sitemapindex>',
      'https://example.com/page-sitemap.xml': '<urlset><url><loc>https://example.com/</loc></url></urlset>',
    })

    await expect(discoverSitemapPages('https://www.example.com')).resolves.toEqual(['https://example.com/'])
    expect(fetch.mock.calls.map(([url]) => url.toString())).toEqual([
      'https://www.example.com/robots.txt',
      'https://example.com/sitemap_index.xml',
      'https://example.com/page-sitemap.xml',
    ])
  })

  it.each([404, new Error('DNS timeout')])('falls back when robots.txt is unavailable (%s)', async (failure) => {
    const fetch = serve({
      'https://example.com/robots.txt': failure,
      'https://example.com/sitemap.xml': '<urlset><url><loc>https://example.com/about</loc></url></urlset>',
    })

    await expect(discoverSitemapPages('https://example.com/blog')).resolves.toEqual(['https://example.com/about'])
    expect(fetch.mock.calls.map(([url]) => url.toString())).toEqual([
      'https://example.com/robots.txt',
      'https://example.com/sitemap.xml',
    ])
  })

  it('ignores comments, empty directives, insecure URLs and other sites in robots.txt', async () => {
    const fetch = serve({
      'https://example.com/robots.txt': [
        '# Sitemap: https://example.com/comment.xml',
        'Sitemap:',
        'Sitemap: http://example.com/insecure.xml',
        'Sitemap: https://other.example.com/foreign.xml',
        'Sitemap: https://example.com.evil.test/spoof.xml',
        '  sItEmAp : https://www.example.com/pages.xml # sitemap',
      ].join('\r\n'),
      'https://www.example.com/pages.xml': '<urlset><url><loc>https://example.com/about</loc></url></urlset>',
    })

    await expect(discoverSitemapPages('https://example.com')).resolves.toEqual(['https://example.com/about'])
    expect(fetch.mock.calls.map(([url]) => url.toString())).toEqual([
      'https://example.com/robots.txt',
      'https://www.example.com/pages.xml',
    ])
    for (const [, , , options] of fetch.mock.calls) {
      expect(options?.allowUrl?.(new URL('https://www.example.com/redirect'))).toBe(true)
      expect(options?.allowUrl?.(new URL('https://evil.test/redirect'))).toBe(false)
    }
  })

  it('tries the next declared sitemap after an unavailable one', async () => {
    serve({
      'https://example.com/robots.txt':
        'Sitemap: https://example.com/missing.xml\nSitemap: https://example.com/pages.xml',
      'https://example.com/pages.xml': '<urlset><url><loc>https://example.com/about</loc></url></urlset>',
    })

    await expect(discoverSitemapPages('https://example.com')).resolves.toEqual(['https://example.com/about'])
  })

  it('caps and deduplicates declared sitemap attempts before using the fallback', async () => {
    const fetch = serve({
      'https://example.com/robots.txt': [
        'Sitemap: https://example.com/missing-0.xml',
        ...Array.from({ length: 10 }, (_, index) => `Sitemap: https://example.com/missing-${index}.xml`),
        'Sitemap: https://example.com/sitemap.xml',
      ].join('\n'),
      'https://example.com/sitemap.xml': '<urlset><url><loc>https://example.com/</loc></url></urlset>',
    })

    await expect(discoverSitemapPages('https://example.com')).resolves.toEqual(['https://example.com/'])
    expect(fetch.mock.calls.map(([url]) => url.toString())).toEqual([
      'https://example.com/robots.txt',
      ...Array.from({ length: 5 }, (_, index) => `https://example.com/missing-${index}.xml`),
      'https://example.com/sitemap.xml',
    ])
  })

  it('falls back when robots.txt exceeds its byte limit', async () => {
    serve({
      'https://example.com/robots.txt': ' '.repeat(512 * 1024 + 1),
      'https://example.com/sitemap.xml': '<urlset><url><loc>https://example.com/</loc></url></urlset>',
    })

    await expect(discoverSitemapPages('https://example.com')).resolves.toEqual(['https://example.com/'])
  })

  it('reads an explicit XML sitemap without requesting robots.txt', async () => {
    const fetch = serve({
      'https://example.com/custom.xml?version=2': '<urlset><url><loc>https://example.com/about</loc></url></urlset>',
    })

    await expect(discoverSitemapPages('https://example.com/custom.xml?version=2')).resolves.toEqual([
      'https://example.com/about',
    ])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('keeps the existing extraction error when no sitemap can be fetched', async () => {
    serve({})

    await expect(discoverSitemapPages('https://example.com')).rejects.toMatchObject({ code: 'unreachable' })
  })
})

beforeEach(stubImports)
afterEach(() => vi.unstubAllGlobals())

// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { extractWebsiteMetadata } from '../../server/utils/websiteImport/metadata'
import { websiteSnapshot, websiteUsage, websiteValueHash } from '../../server/utils/websiteImport/policy'
import {
  emptyWebsiteValues,
  hasWebsiteImportValue,
  isWebsitePage,
  normalizeWebsiteUrl,
  WebsiteValuesSchema,
} from '../../shared/utils/websiteImport'

describe('website import scope', () => {
  it('normalizes the submitted website without losing Czech paths or content parameters', () => {
    expect(normalizeWebsiteUrl(' http://FIRMA.cz/příprava?p=123&utm_source=mail#section ')).toBe(
      'https://firma.cz/p%C5%99%C3%ADprava?p=123',
    )
  })
  it.each([
    'ftp://firma.cz',
    'https://user:password@firma.cz',
    'https://firma.cz:8443',
    'https://127.0.0.1',
    'https://localhost',
    'https://firma.internal',
    'https://firma.cz/?access_token=private',
    'not a website',
  ])('rejects unsafe input %s', (value) => {
    expect(normalizeWebsiteUrl(value)).toBeNull()
  })
  it('keeps search results within the submitted host and excludes account and query traps', () => {
    expect(isWebsitePage('https://www.firma.cz/about', 'https://firma.cz/')).toBe(true)
    expect(isWebsitePage('https://firma.cz/?p=123', 'https://firma.cz/')).toBe(true)
    for (const url of [
      'https://firma.cz.evil.org/about',
      'https://blog.firma.cz/about',
      'https://firma.cz/account',
      'https://firma.cz/?search=coffee',
      'https://firma.cz/?page=100',
    ]) {
      expect(isWebsitePage(url, 'https://firma.cz/'), url).toBe(false)
    }
  })
})

describe('website metadata', () => {
  it('uses declared organization assets and social links without copying a person or executing scripts', () => {
    const result = extractWebsiteMetadata(
      `
      <meta name="theme-color" content="#abc">
      <link rel="icon" href="/favicon.png">
      <script type="application/ld+json">{"@graph":[{"@type":"Person","logo":"https://other.org/person.png"},{"@type":"Organization","logo":{"url":"https://cdn.firma.cz/logo.png"},"sameAs":["https://www.linkedin.com/company/firma"]}]}</script>
      <footer><a href="mailto:person@firma.cz">Contact</a><a href="https://x.com/firma">X</a><a href="https://facebook.com/sharer.php?u=private">Share</a><a href="https://instagram.com.evil.org/firma">Fake</a></footer>
    `,
      'https://firma.cz/about',
    )
    expect(result).toEqual({
      logoUrls: ['https://cdn.firma.cz/logo.png'],
      faviconUrls: ['https://firma.cz/favicon.png'],
      colors: ['#AABBCC'],
      socials: [
        { platform: 'LINKEDIN', url: 'https://www.linkedin.com/company/firma' },
        { platform: 'TWITTER', url: 'https://x.com/firma' },
      ],
    })
  })
  it('ignores invalid JSON-LD and unsafe image schemes', () => {
    const result = extractWebsiteMetadata(
      '<script type="application/ld+json">bad json</script><header><img alt="logo" src="javascript:alert(1)"></header><link rel="icon" href="data:image/png,abc">',
      'https://firma.cz/',
    )
    expect(result.logoUrls).toEqual([])
    expect(result.faviconUrls).toEqual([])
  })
})

describe('website import values and usage', () => {
  it('allows an honest empty result and only offers values actually present', () => {
    const values = emptyWebsiteValues()
    expect(WebsiteValuesSchema.parse(values)).toEqual(values)
    expect(hasWebsiteImportValue('focus', values)).toBe(false)
    expect(hasWebsiteImportValue('knowledge', values, 2)).toBe(true)
    expect(WebsiteValuesSchema.safeParse({ ...values, accentColor: '#invented' }).success).toBe(false)
    expect(WebsiteValuesSchema.safeParse({ ...values, logoUrl: 'javascript:alert(1)' }).success).toBe(false)
  })
  it('takes an explicit safe snapshot and makes social ordering deterministic', () => {
    const site = {
      ...emptyWebsiteValues(),
      language: 'cs' as const,
      keywords: ['káva', 1],
      socials: [
        { platform: 'YOUTUBE' as const, url: 'https://youtube.com/firma' },
        { platform: 'LINKEDIN' as const, url: 'https://linkedin.com/company/firma' },
      ],
      apiKey: 'synthetic-test-key',
    }
    const result = websiteSnapshot(site)
    expect(result).not.toHaveProperty('apiKey')
    expect(result.keywords).toEqual(['káva'])
    expect(result.socials[0]?.platform).toBe('LINKEDIN')
    expect(websiteValueHash(result)).toBe(
      websiteValueHash(websiteSnapshot({ ...site, socials: [...site.socials].reverse() })),
    )
  })
  it('retains unknown search usage rather than reporting zero', () => {
    expect(websiteUsage({ inputTokens: 100, outputTokens: 10 }, undefined, 50, true)).toMatchObject({
      searches: null,
      estimatedCostMicros: 20_015,
    })
    expect(websiteUsage({}, undefined, 50, true)).toBeNull()
  })
  it('records provider search and cache counts and applies the long-context rate', () => {
    const result = websiteUsage(
      { inputTokens: 200_000, outputTokens: 1000 },
      {
        anthropic: {
          usage: {
            server_tool_use: { web_search_requests: 2 },
            cache_read_input_tokens: 30_000,
            cache_creation_input_tokens: 10_000,
          },
        },
      },
      200,
      true,
    )
    expect(result).toMatchObject({
      searches: 2,
      cachedInputTokens: 30_000,
      cacheWriteTokens: 10_000,
      estimatedCostMicros: 127_500,
      durationMs: 200,
    })
  })
})

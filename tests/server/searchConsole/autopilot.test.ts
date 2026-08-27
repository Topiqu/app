import { describe, expect, it } from 'vitest'

import type { SearchTrend } from '../../../server/utils/searchConsole/opportunities'

import {
  articleSlugFromSearchPage,
  isExistingArticleOpportunity,
  selectSeoAutopilotCandidate,
} from '../../../server/utils/searchConsole/autopilot'

const trend = (overrides: Partial<SearchTrend> = {}): SearchTrend => ({
  page: 'https://example.com/en/articles/enterprise-security',
  query: 'enterprise security',
  clicks: 3,
  impressions: 500,
  ctr: 0.006,
  position: 6,
  previousImpressions: 250,
  impressionGrowth: 1,
  ...overrides,
})

describe('Search Console autopilot policy', () => {
  it('maps only localized article URLs to article slugs', () => {
    expect(articleSlugFromSearchPage('https://example.com/cs/clanky/sso-pro-firmy')).toBe('sso-pro-firmy')
    expect(articleSlugFromSearchPage('https://example.com/en/articles/sso-for-business')).toBe('sso-for-business')
    expect(articleSlugFromSearchPage('https://example.com/pricing')).toBeNull()
    expect(articleSlugFromSearchPage('not a url')).toBeNull()
  })

  it('prefers a low-risk CTR fix when a published article has enough demand', () => {
    const candidate = selectSeoAutopilotCandidate(
      [trend(), trend({ page: 'https://example.com/en/articles/second', query: 'second', ctr: 0.04, position: 11 })],
      new Map([
        ['enterprise-security', 'article-1'],
        ['second', 'article-2'],
      ]),
    )
    expect(candidate).toMatchObject({ action: 'CTR_OPTIMIZATION', articleId: 'article-1' })
  })

  it('uses a focused refresh for a striking-distance query with acceptable CTR', () => {
    const candidate = selectSeoAutopilotCandidate(
      [trend({ ctr: 0.04, position: 12 })],
      new Map([['enterprise-security', 'article-1']]),
    )
    expect(candidate).toMatchObject({ action: 'CONTENT_REFRESH', articleId: 'article-1' })
  })

  it('ignores low-volume, uncovered and recently handled signals', () => {
    const articles = new Map([['enterprise-security', 'article-1']])
    expect(selectSeoAutopilotCandidate([trend({ impressions: 199 })], articles)).toBeNull()
    expect(selectSeoAutopilotCandidate([trend()], new Map())).toBeNull()
    expect(
      selectSeoAutopilotCandidate([trend()], articles, new Set(['article-1\u0000enterprise security'])),
    ).toBeNull()
    expect(selectSeoAutopilotCandidate([trend()], articles, new Set(), new Set(['article-1']))).toBeNull()
  })

  it('keeps existing article queries out of new-article topic selection', () => {
    const articles = new Map([['enterprise-security', 'article-1']])
    expect(isExistingArticleOpportunity(trend().page, articles)).toBe(true)
    expect(isExistingArticleOpportunity('https://example.com/pricing', articles)).toBe(false)
  })
})

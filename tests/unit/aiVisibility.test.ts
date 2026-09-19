import { describe, expect, it } from 'vitest'

import {
  aiReferrer,
  closestArticle,
  crawlerSurface,
  isOwnedDomain,
  normalizeCitationUrl,
  promptIntent,
} from '../../shared/utils/aiVisibility'

describe('AI visibility signals', () => {
  it('classifies crawler surfaces without treating arbitrary routes as articles', () => {
    expect(crawlerSurface('/llms.txt')).toBe('LLMS')
    expect(crawlerSurface('/md/cs/clanky/test.md')).toBe('MARKDOWN')
    expect(crawlerSurface('/en/articles/test')).toBe('ARTICLE')
    expect(crawlerSurface('/en')).toBe('HOMEPAGE')
    expect(crawlerSurface('/api/anything')).toBe('OTHER')
  })

  it('recognises only explicit AI referral hosts', () => {
    expect(aiReferrer('https://chatgpt.com/c/abc')).toEqual({ channel: 'CHATGPT', host: 'chatgpt.com' })
    expect(aiReferrer('https://gemini.google.com/app/abc')?.channel).toBe('GEMINI')
    expect(aiReferrer('https://notchatgpt.com/')).toBeNull()
    expect(aiReferrer('javascript:alert(1)')).toBeNull()
  })

  it('normalizes citations and compares domain boundaries', () => {
    expect(normalizeCitationUrl('http://www.Example.com/post/?utm_source=x&b=2&a=1#part')).toBe(
      'https://example.com/post?a=1&b=2',
    )
    expect(isOwnedDomain('news.example.com', 'example.com')).toBe(true)
    expect(isOwnedDomain('notexample.com', 'example.com')).toBe(false)
  })

  it('classifies prompt intent and finds only a meaningful article match', () => {
    expect(promptIntent('Jak vybrat nejlepší AI CMS?')).toBe('COMPARISON')
    expect(
      closestArticle('Jak automatizovat firemní blog', [
        { title: 'Automatizace firemního blogu' },
        { title: 'Úplně jiné téma' },
      ])?.title,
    ).toBe('Automatizace firemního blogu')
    expect(closestArticle('Databázové indexy', [{ title: 'Obsahový marketing' }])).toBeNull()
  })
})

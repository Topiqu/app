import { describe, expect, it } from 'vitest'

import {
  aiReferrer,
  closestArticle,
  crawlerSurface,
  isOwnedDomain,
  normalizeCitationUrl,
  promptIntent,
  promptOutcome,
  runOutcome,
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

describe('AI visibility outcomes', () => {
  const run = (status: string, owned: boolean[] = []) => ({
    status,
    citations: owned.map((value) => ({ owned: value })),
  })

  it('counts a run as cited only when an owned URL is among its citations', () => {
    expect(runOutcome(run('SUCCEEDED', [false, true]))).toBe('CITED')
    expect(runOutcome(run('SUCCEEDED', [false]))).toBe('NOT_CITED')
    expect(runOutcome(run('RUNNING'))).toBe('RUNNING')
    expect(runOutcome(run('FAILED', [true]))).toBe('FAILED')
  })

  it('rolls provider runs into one prompt verdict', () => {
    expect(promptOutcome([])).toEqual({ status: 'UNCHECKED', cited: 0, checked: 0 })
    expect(promptOutcome([run('SUCCEEDED', [true]), run('SUCCEEDED'), run('FAILED')])).toEqual({
      status: 'CITED',
      cited: 1,
      checked: 2,
    })
    expect(promptOutcome([run('SUCCEEDED', [false]), run('RUNNING')])).toEqual({
      status: 'NOT_CITED',
      cited: 0,
      checked: 1,
    })
  })

  it('reports a pending check before a failed one when nothing has answered yet', () => {
    expect(promptOutcome([run('FAILED'), run('RUNNING')]).status).toBe('RUNNING')
    expect(promptOutcome([run('FAILED'), run('FAILED')]).status).toBe('FAILED')
  })
})

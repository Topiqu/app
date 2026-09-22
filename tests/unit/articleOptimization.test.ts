import { describe, expect, it } from 'vitest'

import type { OptimizationCheck } from '../../shared/types/articleOptimization'

import {
  analyzeArticleOptimization,
  classifyArticleUrl,
  getContentEvaluationState,
  scoreOptimizationChecks,
  splitSentences,
} from '../../shared/utils/articleOptimization'

const input = (overrides = {}) => ({
  title: 'A practical guide to article optimization',
  excerpt: 'A useful introduction that explains this complete and practical guide to readers in enough detail.',
  content:
    '<h2>Practical optimization methods</h2><p>A practical guide to article optimization starts with useful structure. It gives readers direct answers.</p><h2>Reliable supporting evidence</h2><p>Read <a href="/related">our guide</a> and <a href="https://example.org/research">the research</a>.</p>',
  imageUrl: '/cover.jpg',
  sources: ['https://example.org/research'],
  tenantDomain: 'topiqu.test',
  ...overrides,
})
const find = (result: ReturnType<typeof analyzeArticleOptimization>, id: string) =>
  result.checks.find((check) => check.id === id)!

describe('article optimization', () => {
  it('treats a blank article as dependency-safe', () => {
    const result = analyzeArticleOptimization(input({ title: '', excerpt: '', content: '', imageUrl: '', sources: [] }))
    expect(find(result, 'title-exists').status).toBe('error')
    expect(find(result, 'heading-hierarchy').status).toBe('not-applicable')
    expect(result.contentState).toBe('empty')
    expect(result.categories.find((item) => item.category === 'seo')).toMatchObject({
      status: 'evaluated',
      score: 0,
    })
  })

  it('gives near-empty random content zero SEO and marks content categories as insufficient', () => {
    const result = analyzeArticleOptimization(
      input({
        content:
          '<h2>Things</h2><p>Random words without useful detail.</p><p>Another tiny fragment.</p><ul><li>One</li><li>Two</li><li>Three</li><li>Four</li></ul>',
      }),
    )

    expect(result.contentState).toBe('insufficient')
    expect(result.categories.find((item) => item.category === 'seo')).toMatchObject({
      status: 'evaluated',
      score: 0,
    })
    expect(result.categories.find((item) => item.category === 'ai-visibility')).toEqual({
      category: 'ai-visibility',
      status: 'insufficient-data',
      score: null,
    })
    expect(result.categories.find((item) => item.category === 'readability')).toEqual({
      category: 'readability',
      status: 'insufficient-data',
      score: null,
    })
    expect(result.overallScore).toBe(0)
  })

  it('ignores markup and media-only documents when evaluating content', () => {
    expect(getContentEvaluationState({ content: '<h2></h2><img src="cover.jpg"><video></video>' })).toBe('empty')
    expect(getContentEvaluationState({ content: '<ul><li>One</li><li>Two</li></ul>' })).toBe('insufficient')
  })

  it('caps SEO when a substantial article has no title', () => {
    const prose = Array.from({ length: 130 }, (_, index) => `word${index}`).join(' ')
    const result = analyzeArticleOptimization(input({ title: '', content: `<p>${prose}.</p>` }))
    expect(result.contentState).toBe('substantial')
    expect(result.categories.find((item) => item.category === 'seo')?.score).toBeLessThanOrEqual(25)
  })

  it('checks SEO structure, links, image and alt text', () => {
    const result = analyzeArticleOptimization(
      input({
        content: '<h1>Duplicate</h1><h3>Jump</h3><p><img src="x.jpg"><a href="javascript:alert(1)">bad</a></p>',
      }),
    )
    expect(find(result, 'single-h1').status).toBe('error')
    expect(find(result, 'heading-hierarchy').status).toBe('error')
    expect(find(result, 'image-alt').status).toBe('error')
    expect(find(result, 'external-links-safe').status).toBe('error')
  })

  it('checks readability and stable block targets', () => {
    const long = Array.from({ length: 121 }, (_, i) => `word${i}`).join(' ')
    const result = analyzeArticleOptimization(input({ content: `<p>${long}.</p>` }))
    expect(find(result, 'paragraph-length')).toMatchObject({ status: 'warning', target: { blockIndex: 0 } })
    expect(find(result, 'section-length').status).toBe('passed')
  })

  it('checks title terms, headings, blocks and source diversity', () => {
    const content = `<p>${Array.from({ length: 810 }, () => 'unrelated').join(' ')}</p>`
    const result = analyzeArticleOptimization(input({ content, sources: ['https://one.test/a'] }))
    expect(find(result, 'topic-introduction').status).toBe('warning')
    expect(find(result, 'descriptive-sections').status).toBe('warning')
    expect(find(result, 'multiple-blocks').status).toBe('warning')
    expect(find(result, 'source-diversity').status).toBe('warning')
  })

  it('validates sources and excludes image checks without inline images', () => {
    const result = analyzeArticleOptimization(input({ sources: ['notaurl'] }))
    expect(find(result, 'sources-valid').status).toBe('error')
    expect(find(result, 'image-alt').status).toBe('not-applicable')
  })

  it('classifies relative, tenant and external URLs', () => {
    expect(classifyArticleUrl('/clanky/a', 'news.test')).toBe('internal')
    expect(classifyArticleUrl('https://www.news.test/a', 'news.test')).toBe('internal')
    expect(classifyArticleUrl('https://example.org/a', 'news.test')).toBe('external')
    expect(classifyArticleUrl('javascript:void(0)', 'news.test')).toBe('invalid')
  })

  it('scores passed, warning and error weights and excludes N/A', () => {
    const checks = [
      { status: 'passed', weight: 2 },
      { status: 'warning', weight: 2 },
      { status: 'error', weight: 2 },
      { status: 'not-applicable', weight: 100 },
    ].map((value, index) => ({
      ...value,
      id: String(index),
      category: 'seo',
      source: 'local',
      target: { kind: 'content' },
    })) as OptimizationCheck[]
    const result = scoreOptimizationChecks(checks)
    expect(result.categories.find((item) => item.category === 'seo')?.score).toBe(50)
    expect(result.overallScore).toBe(88)
  })

  it('splits Czech and English sentences', () => {
    expect(splitSentences('První věta je zde. Druhá věta pokračuje!')).toHaveLength(2)
    expect(splitSentences('First sentence is here. Another sentence follows?')).toHaveLength(2)
  })
})

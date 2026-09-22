import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import type { FactCheckClaim } from '../../shared/types/articleFactCheck'

import { extractReadableSource } from '../../server/utils/factCheckSources'
import {
  extractFactCheckBlocks,
  factCheckCounts,
  normalizeFactCheckUrl,
  sortFactCheckClaims,
} from '../../shared/utils/articleFactCheck'

const claim = (overrides: Partial<FactCheckClaim> = {}): FactCheckClaim => ({
  id: 'claim',
  text: 'The product launched in 2026.',
  blockIndex: 0,
  verdict: 'supported',
  importance: 'medium',
  explanation: 'The source states the same date.',
  sourceMatches: [],
  ...overrides,
})

describe('article fact-check helpers', () => {
  it('uses the standard AI entitlement and token-ledger flow', () => {
    const endpoint = readFileSync(resolve(process.cwd(), 'server/api/articles/fact-check.post.ts'), 'utf8')
    expect(endpoint).toContain("requireTenantScope(event, 'AI_USE'")
    expect(endpoint).toContain('requireAiPlan(')
    expect(endpoint).toContain("withTokenReservation(\n    user.clientSiteId,\n    40_000,\n    'ARTICLE_FACT_CHECK'")
    expect(endpoint).toContain('consumeClientTokens(\n        user.clientSiteId')
    expect(endpoint).toContain("'ARTICLE_FACT_CHECK'")
  })

  it('uses the primary language instead of the source-tab sentinel', () => {
    const editor = readFileSync(resolve(process.cwd(), 'app/pages/admin/editor/[id].vue'), 'utf8')
    expect(editor).toContain('isNew ? newArticleLanguage.value : tr.isSource ? primaryLanguage : tr.activeLang')
    expect(editor).not.toContain('language: editorLanguageModel.value as Language')
  })

  it('keeps stable top-level editor indexes while ignoring media-only blocks', () => {
    expect(
      extractFactCheckBlocks(
        '<h2>Overview</h2><p>The product launched in 2026.</p><img src="x.jpg"><p>More detail.</p>',
      ),
    ).toEqual([
      { index: 0, type: 'h2', text: 'Overview' },
      { index: 1, type: 'p', text: 'The product launched in 2026.' },
      { index: 3, type: 'p', text: 'More detail.' },
    ])
  })

  it('normalizes URLs for deterministic duplicate detection', () => {
    expect(normalizeFactCheckUrl('https://EXAMPLE.com:443/report#results')).toBe('https://example.com/report')
  })

  it('counts problem verdicts without presenting unverifiable claims as errors', () => {
    const counts = factCheckCounts([
      claim(),
      claim({ verdict: 'partial' }),
      claim({ verdict: 'unsupported' }),
      claim({ verdict: 'contradicted' }),
      claim({ verdict: 'unverifiable' }),
    ])
    expect(counts).toMatchObject({ total: 5, supported: 1, problematic: 3, unverifiable: 1 })
  })

  it('prioritizes contradictions and important claims over supported ones', () => {
    const sorted = sortFactCheckClaims([
      claim({ id: 'supported', verdict: 'supported' }),
      claim({ id: 'low', verdict: 'unsupported', importance: 'low' }),
      claim({ id: 'critical', verdict: 'contradicted', importance: 'high' }),
    ])
    expect(sorted.map((item) => item.id)).toEqual(['critical', 'low', 'supported'])
  })

  it('extracts readable article text and publication metadata from a source', () => {
    const source = extractReadableSource(`
      <html><head><title>Research report</title><meta property="article:published_time" content="2026-09-01"></head>
      <body><nav>Navigation that should be ignored</nav><article><h1>Research report</h1>
      <p>The measured system completed the task three times faster in the controlled benchmark.</p></article></body></html>
    `)
    expect(source.title).toBe('Research report')
    expect(source.publishedAt).toBe('2026-09-01')
    expect(source.content).toContain('three times faster')
    expect(source.content).not.toContain('Navigation')
  })
})

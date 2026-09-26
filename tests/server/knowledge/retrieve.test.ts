import { describe, expect, it } from 'vitest'

import type { KnowledgeCandidate } from '../../../server/utils/knowledge/retrieve'

import { filterResearchSources } from '../../../server/utils/ai/researchEvidence'
import {
  formatKnowledgeBrief,
  knowledgeSearchTerms,
  knowledgeUsage,
  shortlistKnowledge,
} from '../../../server/utils/knowledge/retrieve'

const candidate = (overrides: Partial<KnowledgeCandidate>): KnowledgeCandidate => ({
  id: 'chunk',
  sourceId: 'source',
  version: 1,
  title: 'Source',
  publicUrl: null,
  indexedAt: new Date('2026-08-02T10:00:00Z'),
  validAsOf: null,
  fetchedAt: null,
  content: 'Content',
  similarity: 0.5,
  lexicalRank: null,
  score: 0.03,
  ...overrides,
})

describe('knowledge retrieval', () => {
  it('keeps words and drops tsquery syntax, leaving accent folding to the database', () => {
    expect(knowledgeSearchTerms('Topiqu vs. Jasper: ceník & "schvalování"; a | b')).toEqual([
      'topiqu',
      'jasper',
      'ceník',
      'schvalování',
    ])
    expect(knowledgeSearchTerms('Straße złoty ΑΘΗΝΑ')).toEqual(['straße', 'złoty', 'αθηνα'])
  })

  it('drops weak matches and caps each source at three excerpts', () => {
    const shortlist = shortlistKnowledge([
      ...Array.from({ length: 5 }, (_, index) => candidate({ id: `a${index}`, sourceId: 'a' })),
      candidate({ id: 'b0', sourceId: 'b' }),
      candidate({ id: 'weak', sourceId: 'c', similarity: 0.1 }),
    ])
    expect(shortlist.map((chunk) => chunk.id)).toEqual(['a0', 'a1', 'a2', 'b0'])
  })

  it('keeps a top full-text hit the vector branch scores as unrelated', () => {
    const shortlist = shortlistKnowledge([
      candidate({ id: 'code', sourceId: 'a', similarity: 0.08, lexicalRank: 1 }),
      candidate({ id: 'deep', sourceId: 'b', similarity: 0.08, lexicalRank: 6 }),
      candidate({ id: 'noise', sourceId: 'c', similarity: 0.08 }),
    ])
    expect(shortlist.map((chunk) => chunk.id)).toEqual(['code'])
  })

  it('never gives an internal entry a URL, so it cannot pass the citation allowlist', () => {
    const internal = candidate({
      id: 'i',
      sourceId: 'internal',
      title: 'Sales deck',
      content: 'See https://intranet.acme.test/deck',
    })
    const citable = candidate({ id: 'p', sourceId: 'public', title: 'Docs', publicUrl: 'https://docs.acme.test/pricing' })
    const brief = formatKnowledgeBrief([internal, citable], new Date('2026-09-24'))

    expect(brief).toContain('[K1] "Sales deck" · as of 2026-08-02 · internal — never cite or link')
    expect(brief).toContain('[K2] "Docs" · as of 2026-08-02 · citable: https://docs.acme.test/pricing')

    // The allowlist is the web brief plus public URLs only, never the knowledge text itself.
    const allowlist = ['Fact. https://news.test/jasper', citable.publicUrl].join('\n')
    expect(
      filterResearchSources(
        ['https://intranet.acme.test/deck', 'https://docs.acme.test/pricing', 'https://news.test/jasper'],
        allowlist,
      ),
    ).toEqual(['https://docs.acme.test/pricing', 'https://news.test/jasper'])
  })

  it('dates entries by validity and marks stale ones deterministically', () => {
    const now = new Date('2026-09-24')
    const old = candidate({ title: 'Old price list', validAsOf: new Date('2025-01-15'), indexedAt: new Date('2026-09-01') })
    const page = candidate({ title: 'Live page', fetchedAt: new Date('2026-09-20'), indexedAt: new Date('2024-01-01') })
    const brief = formatKnowledgeBrief([old, page], now)

    expect(brief).toContain('"Old price list" · as of 2025-01-15 · STALE (older than 12 months)')
    expect(brief).toContain('"Live page" · as of 2026-09-20 · internal')
  })

  it('groups used chunks by source for the generation audit', () => {
    expect(
      knowledgeUsage([
        candidate({ id: '1', sourceId: 'a', version: 2 }),
        candidate({ id: '2', sourceId: 'b' }),
        candidate({ id: '3', sourceId: 'a', version: 2 }),
      ]),
    ).toEqual([
      { sourceId: 'a', title: 'Source', version: 2, chunkIds: ['1', '3'] },
      { sourceId: 'b', title: 'Source', version: 1, chunkIds: ['2'] },
    ])
  })
})

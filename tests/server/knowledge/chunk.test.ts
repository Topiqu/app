import { describe, expect, it } from 'vitest'

import { chunkKnowledge } from '../../../server/utils/knowledge/chunk'

const paragraph = (seed: string, length: number) =>
  `${seed} `.repeat(Math.ceil(length / (seed.length + 1))).trim()

describe('chunkKnowledge', () => {
  it('prefixes every chunk with the source title and heading path', () => {
    const chunks = chunkKnowledge(
      'Topiqu',
      [
        '# Pricing',
        '## Pro plan',
        paragraph('Pro costs 29 USD a month.', 500),
        '## Premium',
        paragraph('Premium adds autopilot.', 500),
      ].join('\n'),
    )
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toMatch(/^Topiqu › Pricing › Pro plan\n\nPro costs/)
    expect(chunks[1]).toMatch(/^Topiqu › Pricing › Premium\n\nPremium adds/)
  })

  it('keeps chunks near the target size and splits oversized paragraphs', () => {
    const chunks = chunkKnowledge('Doc', paragraph('A long sentence about content operations.', 9_000))
    expect(chunks.length).toBeGreaterThanOrEqual(5)
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(2 * 2_000 + 50)
  })

  it('merges tiny sections instead of emitting a chunk per heading', () => {
    const chunks = chunkKnowledge('FAQ', ['# A', 'Short answer one here.', '# B', 'Short answer two here.'].join('\n'))
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toContain('Short answer two here.')
  })

  it('carries a short trailing line into the next chunk as overlap', () => {
    const lines = Array.from({ length: 12 }, (_, index) => `Line ${index} ${paragraph('text', 250)}`)
    const chunks = chunkKnowledge('Doc', lines.join('\n'))
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[1]).toContain(chunks[0]!.split('\n').at(-1)!)
  })
})

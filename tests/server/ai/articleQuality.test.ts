import { describe, expect, it } from 'vitest'

import {
  buildEditorialReviewPrompt,
  buildRevisionPrompt,
  editorialReviewSchema,
  verdictLines,
} from '../../../server/utils/ai/articleQuality'

const draft = {
  title: 'Switch 2 zachová část knihovny',
  perex: 'Kompatibilita se liší titul od titulu.',
  content: '<h2>Kompatibilita</h2><p>Pro hráče v září 2026 je nutné vše individuálně ověřit.</p>',
  sources: ['https://www.nintendo.com/'],
}

describe('article copy desk', () => {
  it('receives the assignment, grounding and complete draft', () => {
    const prompt = buildEditorialReviewPrompt(draft, {
      prompt: 'Explain concrete compatibility exceptions.',
      researchBrief: 'Nintendo Labo VR cannot be played. https://www.nintendo.com/',
      format: 'news',
    })

    expect(prompt).toContain('Explain concrete compatibility exceptions.')
    expect(prompt).toContain('Nintendo Labo VR cannot be played.')
    expect(prompt).toContain('Pro hráče v září 2026')
  })

  it('turns review findings into direct revision instructions', () => {
    const review = editorialReviewSchema.parse({
      approved: false,
      issues: [{ code: 'stale_framing', note: 'Delete the artificial September 2026 framing.' }],
    })
    const prompt = buildRevisionPrompt('Explain compatibility.', draft, review)

    expect(prompt).toContain('stale_framing')
    expect(prompt).toContain('Delete the artificial September 2026 framing.')
    expect(prompt).toContain('complete replacement object')
  })

  it('rejects an approval that carries no actionable issue shape', () => {
    expect(
      editorialReviewSchema.safeParse({
        approved: false,
        issues: [{ code: 'vibes', note: 'This is bad.' }],
      }).success,
    ).toBe(false)
  })
})

describe('verification audit', () => {
  it('keeps every verdict, including those without a web URL, and drops the chatter', () => {
    const text = [
      'I checked the draft against live sources.',
      '- **SUPPORTED** — Pro costs 49 USD — first-party knowledge — 2026-09',
      '1. UNSUPPORTED MATERIAL — "Ciri returns" — no source confirms it',
      'CONTRADICTED — release in 2025 — delayed to 2027 — https://example.com/news',
      'NOT VERIFIED — minor detail',
      'Overall the draft needs two fixes.',
    ].join('\n')
    expect(verdictLines(text)?.split('\n')).toHaveLength(4)
    expect(verdictLines(text)).toContain('Pro costs 49 USD')
    expect(verdictLines('No verdicts here.')).toBeNull()
  })
})

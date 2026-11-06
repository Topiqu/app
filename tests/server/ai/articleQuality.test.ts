import { describe, expect, it, beforeEach } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/ai/reasoning'), 'aiReasoning')
  await stubNitroImports(
    import('../../../server/utils/ai/editorialPolicy'),
    'AUTHORIAL_REASONING',
    'ILLUSTRATIVE_STORY',
  )
  await stubNitroImports(
    import('../../../server/utils/ai/researchEvidence'),
    'extractResearchUrls',
    'researchEvidence',
    'retrievedResearchSources',
  )
}

await stubImports()

const {
  applyRevisionEdits,
  buildEditorialReviewPrompt,
  buildEditPrompt,
  buildRevisionPrompt,
  editorialReviewSchema,
  onlyRemoves,
  verdictLines,
} = await import('../../../server/utils/ai/articleQuality')

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
      issues: [{ code: 'stale_framing', note: 'Delete the artificial September 2026 framing.', blocking: false }],
    })
    const prompt = buildRevisionPrompt('Explain compatibility.', draft, { approved: true, ...review })

    expect(prompt).toContain('stale_framing')
    expect(prompt).toContain('Delete the artificial September 2026 framing.')
    expect(prompt).toContain('complete replacement object')
    expect(prompt).toContain('Limit factual repairs to the claims the findings actually identify')
  })

  it('rejects an approval that carries no actionable issue shape', () => {
    expect(
      editorialReviewSchema.safeParse({
        approved: false,
        issues: [{ code: 'vibes', note: 'This is bad.' }],
      }).success,
    ).toBe(false)
  })

  it('accepts an actionable assignment mismatch for revision', () => {
    const issue = {
      code: 'assignment_mismatch',
      note: 'The title replaces the requested argument with a civility lecture. Restore the assigned stance.',
      blocking: true,
    }
    const review = { approved: false, ...editorialReviewSchema.parse({ issues: [issue] }) }

    expect(buildRevisionPrompt('Write an aggressive political opinion.', draft, review)).toContain(
      `assignment_mismatch: ${issue.note}`,
    )
  })

  it('accepts a verbose review, whose caps the provider does not enforce', () => {
    const issue = { code: 'missing_specifics', note: 'Name the passage. '.repeat(30), blocking: false }

    expect(editorialReviewSchema.safeParse({ issues: Array(8).fill(issue) }).success).toBe(true)
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

describe('revision edits', () => {
  const article = {
    title: 'Pokuty za stavbu bez povolení',
    perex: 'Co hrozí stavebníkovi.',
    content: '<h2>Pokuty</h2><p>Pokuta je až 2 mil. Kč.</p><p>Úřad   může nařídit odstranění.</p>',
    keyTakeaways: ['Pokuta až 2 mil. Kč', 'Hrozí odstranění'],
  }
  const none = { title: null, perex: null, answer: null, keyTakeaways: null, faq: null, sources: null }

  it('applies replacements and insertions and reports only the changed text', () => {
    const result = applyRevisionEdits(article, {
      ...none,
      edits: [
        {
          find: '<p>Pokuta je až 2 mil. Kč.</p>',
          replace: '<p>Pokuta je až 2 mil. Kč, u firem až 4 mil. Kč.</p>',
          insertAfter: false,
        },
        { find: '<h2>Pokuty</h2>', replace: '<p>Výše závisí na typu stavby.</p>', insertAfter: true },
      ],
    })
    expect(result).toMatchObject({ ok: true })
    if (!result.ok) return
    expect(result.draft.content).toBe(
      '<h2>Pokuty</h2><p>Výše závisí na typu stavby.</p><p>Pokuta je až 2 mil. Kč, u firem až 4 mil. Kč.</p><p>Úřad   může nařídit odstranění.</p>',
    )
    expect(result.changes.map((change) => change.after)).toEqual([
      '<p>Pokuta je až 2 mil. Kč, u firem až 4 mil. Kč.</p>',
      '<p>Výše závisí na typu stavby.</p>',
    ])
  })

  it('tolerates whitespace differences in a quoted excerpt', () => {
    const result = applyRevisionEdits(article, {
      ...none,
      edits: [
        { find: 'Úřad může nařídit odstranění.', replace: 'Úřad může nařídit odstranění stavby.', insertAfter: false },
      ],
    })
    expect(result.ok && result.draft.content).toContain('odstranění stavby.')
  })

  it.each([
    ['missing', 'Pokuta je až 9 mil. Kč.'],
    ['ambiguous', '<p>'],
  ])('fails as a whole when its only excerpt is %s', (_label, find) => {
    const result = applyRevisionEdits(article, {
      ...none,
      title: 'Changed title that must not ship alone',
      edits: [{ find, replace: '', insertAfter: false }],
    })
    expect(result).toEqual({ ok: false, reason: 'excerpt_not_found' })
  })

  it('skips a missing or ambiguous excerpt and applies the rest', () => {
    const result = applyRevisionEdits(article, {
      ...none,
      edits: [
        { find: 'Pokuta je až 9 mil. Kč.', replace: '', insertAfter: false },
        { find: '<p>', replace: '', insertAfter: false },
        { find: 'Úřad může nařídit odstranění.', replace: 'Úřad nařídí odstranění.', insertAfter: false },
      ],
    })
    expect(result).toMatchObject({ ok: true, skipped: 2 })
    expect(result.ok && result.draft.content).toContain('<p>Pokuta je až 2 mil. Kč.</p><p>Úřad nařídí odstranění.</p>')
  })

  it('replaces whole fields and lists only when given', () => {
    const result = applyRevisionEdits(article, { ...none, edits: [], keyTakeaways: ['Pokuta až 2 mil. Kč'] })
    expect(result.ok && result.draft).toMatchObject({ title: article.title, keyTakeaways: ['Pokuta až 2 mil. Kč'] })
  })

  it('in removal-only mode accepts deletions and rejects any added word or tag', () => {
    const remove = (find: string, replace: string) =>
      applyRevisionEdits(article, { ...none, edits: [{ find, replace, insertAfter: false }] }, { removalOnly: true })
    expect(remove('<p>Pokuta je až 2 mil. Kč.</p>', '')).toMatchObject({ ok: true })
    expect(remove('Úřad   může nařídit odstranění.', 'Úřad může odstranění.')).toMatchObject({ ok: true })
    expect(remove('Pokuta je až 2 mil. Kč.', 'Pokuta je až 3 mil. Kč.')).toEqual({ ok: false, reason: 'not_a_removal' })
    expect(remove('Pokuta je až 2 mil. Kč.', 'Pokuta je <a href="https://x.test">až</a> 2 mil. Kč.')).toEqual({
      ok: false,
      reason: 'not_a_removal',
    })
    expect(
      applyRevisionEdits(article, { ...none, edits: [], perex: 'Co hrozí investorovi.' }, { removalOnly: true }),
    ).toEqual({ ok: false, reason: 'not_a_removal' })
  })

  it('appends the citations an edit needs, but never from a removal', () => {
    const cited = { ...article, sources: ['https://a.test/1'] }
    const sources = ['https://a.test/1', 'https://b.test/2']
    const added = applyRevisionEdits(cited, { ...none, edits: [], sources })
    expect(added.ok && added.draft.sources).toEqual(sources)
    const removed = applyRevisionEdits(cited, { ...none, edits: [], sources }, { removalOnly: true })
    expect(removed.ok && removed.draft.sources).toEqual(['https://a.test/1'])
  })

  it('counts repeated words, so a removal cannot duplicate one', () => {
    expect(onlyRemoves('až 2 mil. Kč', '2 2 mil.')).toBe(false)
    expect(onlyRemoves('až 2 mil. Kč', 'až mil.')).toBe(true)
  })

  it('asks for edits rather than a rewrite while sharing the correction rules', () => {
    const prompt = buildEditPrompt('Explain fines.', article, { approved: false, issues: [] })
    expect(prompt).toContain('Return edits, not a new article')
    expect(prompt).toContain('Limit factual repairs to the claims the findings actually identify')
    expect(prompt).not.toContain('complete replacement object')
  })
})

beforeEach(stubImports)

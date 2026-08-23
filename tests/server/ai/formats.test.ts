import { describe, expect, it } from 'vitest'

import {
  ARTICLE_FORMATS,
  ARTICLE_FORMAT_NAMES,
  applyFormat,
  formatMenu,
  formatRules,
  isArticleFormat,
} from '../../../server/utils/ai/formats'

const full = {
  answer: 'a forty word answer that the format may or may not want to keep',
  keyTakeaways: ['Prices rose 12% in 2025'],
  faq: [{ question: 'How much?', answer: 'Twelve percent.' }],
  polls: [{ question: 'Which first?', options: ['A', 'B'] }],
}

describe('format catalogue', () => {
  it('offers every format to the picker', () => {
    const menu = formatMenu()

    for (const name of ARTICLE_FORMAT_NAMES) expect(menu).toContain(`- ${name}:`)
  })

  it('narrows an unknown string', () => {
    expect(isArticleFormat('guide')).toBe(true)
    expect(isArticleFormat('verdict')).toBe(false)
    expect(isArticleFormat(undefined)).toBe(false)
  })
})

describe('formatRules', () => {
  it.each(ARTICLE_FORMAT_NAMES)('%s never mentions an element it forbids', (name) => {
    const spec = ARTICLE_FORMATS[name]
    const rules = formatRules(name)

    expect(rules).toContain(`${spec.words[0]}-${spec.words[1]} words`)
    if (!spec.table) expect(rules).toContain('must NOT contain')
    if (!spec.faq) expect(rules).toContain('"faq": return an empty array')
    if (!spec.answer) expect(rules).toContain('"answer": return an empty string')
    if (!spec.takeaways) expect(rules).toContain('"keyTakeaways": return an empty array')
  })

  // The closing verdict section is the single most recognisable tell, and no format wants one.
  it.each([...ARTICLE_FORMAT_NAMES, undefined])('%s bans the closing verdict and the contrast pair', (name) => {
    const rules = formatRules(name)

    expect(rules).toMatch(/Verdict|Verdikt/)
    expect(rules).toContain('not X, but Y')
  })

  it('leaves the manual flow the full menu', () => {
    const rules = formatRules()

    expect(rules).toContain('Tables and polls are both optional')
    expect(rules).not.toContain('must NOT contain')
  })
})

describe('applyFormat', () => {
  it('clears what the format does not carry', () => {
    const opinion = applyFormat(full, 'opinion')

    expect(opinion.answer).toBe('')
    expect(opinion.keyTakeaways).toEqual([])
    expect(opinion.faq).toEqual([])
    // opinion keeps polls — the point is that the clearing is per element, not all-or-nothing.
    expect(opinion.polls).toHaveLength(1)
  })

  it('keeps what the format does carry', () => {
    const guide = applyFormat(full, 'guide')

    expect(guide.answer).toBe(full.answer)
    expect(guide.keyTakeaways).toEqual(full.keyTakeaways)
    expect(guide.faq).toEqual(full.faq)
    expect(guide.polls).toEqual([])
  })

  // The manual editor flow has no format and must not be silently stripped.
  it('is a passthrough without a format', () => {
    expect(applyFormat(full, undefined)).toEqual(full)
  })

  it.each(ARTICLE_FORMAT_NAMES)('%s agrees with its own catalogue entry', (name) => {
    const spec = ARTICLE_FORMATS[name]
    const applied = applyFormat(full, name)

    expect(applied.answer === '').toBe(!spec.answer)
    expect(applied.keyTakeaways!.length > 0).toBe(spec.takeaways)
    expect(applied.faq!.length > 0).toBe(spec.faq)
    expect(applied.polls!.length > 0).toBe(spec.poll)
  })
})

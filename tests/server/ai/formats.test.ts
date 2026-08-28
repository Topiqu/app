import { describe, expect, it } from 'vitest'

import {
  allowedModulesFor,
  ARTICLE_FORMATS,
  ARTICLE_FORMAT_NAMES,
  applyFormat,
  formatMenu,
  formatRules,
  isArticleFormat,
  isStructureVariantFor,
} from '../../../server/utils/ai/formats'

const full = {
  answer: 'a forty word answer that the format may or may not want to keep',
  keyTakeaways: ['Prices rose 12% in 2025'],
  faq: [{ question: 'How much?', answer: 'Twelve percent.' }],
  polls: [{ question: 'Which first?', options: ['A', 'B'] }],
  videos: [{ url: 'https://youtu.be/dQw4w9WgXcQ', caption: 'Demo' }],
}

describe('format catalogue', () => {
  it('offers every format, variant and module choice to the picker', () => {
    const menu = formatMenu()

    for (const name of ARTICLE_FORMAT_NAMES) {
      expect(menu).toContain(`- ${name}:`)
      for (const variant of Object.keys(ARTICLE_FORMATS[name].variants)) expect(menu).toContain(variant)
    }
    expect(menu).toContain('Optional modules')
  })

  it('narrows formats and format-specific variants', () => {
    expect(isArticleFormat('guide')).toBe(true)
    expect(isArticleFormat('verdict')).toBe(false)
    expect(isStructureVariantFor('analysis', 'claim-audit')).toBe(true)
    expect(isStructureVariantFor('guide', 'claim-audit')).toBe(false)
  })
})

describe('formatRules', () => {
  it.each(ARTICLE_FORMAT_NAMES)('%s describes its selected variant and module budget', (name) => {
    const spec = ARTICLE_FORMATS[name]
    const variant = Object.keys(spec.variants)[0]!
    const rules = formatRules(name, variant, spec.defaultModules)

    expect(rules).toContain(`${spec.words[0]}-${spec.words[1]} words`)
    expect(rules).toContain(`Structure variant: ${variant}`)
    if (!spec.defaultModules.includes('table')) expect(rules).toContain('must NOT contain an HTML table')
    if (!spec.defaultModules.includes('faq')) expect(rules).toContain('"faq": return an empty array')
    if (!spec.defaultModules.includes('answer')) expect(rules).toContain('"answer": return an empty string')
  })

  it.each([...ARTICLE_FORMAT_NAMES, undefined])('%s bans the closing verdict and contrast pair', (name) => {
    const rules = formatRules(name)

    expect(rules).toMatch(/Verdict|Verdikt/)
    expect(rules).toContain('not X, but Y')
  })

  it('leaves the manual flow broad but makes optional blocks default to none', () => {
    const rules = formatRules()

    expect(rules).toContain('Tables, polls and videos are optional')
    expect(rules).not.toContain('must NOT contain')
  })
})

describe('applyFormat', () => {
  it('keeps only explicitly selected structured modules', () => {
    const opinion = applyFormat(full, 'opinion', [])

    expect(opinion.answer).toBe('')
    expect(opinion.keyTakeaways).toEqual([])
    expect(opinion.faq).toEqual([])
    expect(opinion.polls).toEqual([])
    expect(opinion.videos).toEqual([])
  })

  it('keeps selected modules and removes allowed but unselected ones', () => {
    const guide = applyFormat(full, 'guide', ['faq', 'youtube'])

    expect(guide.answer).toBe('')
    expect(guide.keyTakeaways).toEqual([])
    expect(guide.faq).toEqual(full.faq)
    expect(guide.polls).toEqual([])
    expect(guide.videos).toEqual(full.videos)
  })

  it('silently drops modules the format does not allow', () => {
    const story = applyFormat(full, 'story', ['faq', 'youtube'])

    expect(story.faq).toEqual([])
    expect(story.videos).toEqual(full.videos)
    expect(allowedModulesFor('story')).toEqual(['youtube'])
  })

  it('retains legacy defaults when modules were not specified', () => {
    const guide = applyFormat(full, 'guide')

    expect(guide.answer).toBe(full.answer)
    expect(guide.keyTakeaways).toEqual(full.keyTakeaways)
    expect(guide.faq).toEqual(full.faq)
    expect(guide.polls).toEqual([])
  })

  it('is a passthrough without a format', () => {
    expect(applyFormat(full, undefined)).toEqual(full)
  })
})

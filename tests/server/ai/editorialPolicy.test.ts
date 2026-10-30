import { describe, expect, it } from 'vitest'

import { editorialPolicy } from '../../../server/utils/ai/editorialPolicy'

describe('editorial policy', () => {
  it('limits statements about missing evidence to corrections, reported status and conflicts', () => {
    expect(editorialPolicy('analysis', 'LOW')).toContain('Write about the topic, never about the research behind it')
  })

  it('distinguishes expressive judgments from concrete allegations for factual verification', () => {
    const policy = editorialPolicy('opinion', 'HIGH')
    expect(policy).toContain('Do not fact-check them as literal factual allegations')
    expect(policy).toContain(
      'Concrete claims about real acts, crimes, motives or affiliations still require factual grounding',
    )
  })

  it('allows an invented illustrative story only when the author asks for it in the editor', () => {
    expect(editorialPolicy('story', 'LOW', true)).toContain('illustrative narrative')
    const unattended = editorialPolicy('story', 'LOW')
    expect(unattended).not.toContain('illustrative narrative')
    expect(unattended).toContain('Never invent a protagonist, scene or event')
    expect(editorialPolicy('analysis', 'LOW')).not.toContain('Never invent a protagonist')
  })

  it('frames an illustrative story in the perex and lets its fictional characters talk', () => {
    const policy = editorialPolicy('story', 'LOW', true)
    expect(policy).toContain('the body never contains a sentence explaining what is fictional and what is real')
    expect(policy).toContain('may speak in invented dialogue')
    expect(policy).toContain("never put invented words in a real person's mouth")
  })

  it('makes a HIGH story carry its voice in the narrator', () => {
    expect(editorialPolicy('story', 'HIGH', true)).toContain('A neutral, report-like retelling')
    expect(editorialPolicy('story', 'LOW', true)).not.toContain('A neutral, report-like retelling')
  })

  it('narrates a story in scenes instead of arguing a thesis', () => {
    expect(editorialPolicy('story', 'LOW')).toContain('sequence of scenes, in the past tense')
    expect(editorialPolicy('story', 'LOW')).not.toContain('central question or thesis')
    expect(editorialPolicy('analysis', 'LOW')).toContain('central question or thesis')
  })

  it('preserves a requested opinion without injecting illustrative-story framing', () => {
    const policy = editorialPolicy('opinion', 'HIGH', true)
    expect(policy).toContain('defend the position the author actually requested')
    expect(policy).toContain('sarcasm, satire, anger or profanity')
    expect(policy).not.toContain('illustrative narrative')
    expect(policy).toContain('Never invent criminal allegations')
    expect(policy).toContain('keep the title and perex centered on the requested argument')
  })

  it('shares the publisher tone while allowing an explicit assignment to override it', () => {
    const policy = editorialPolicy('opinion', 'HIGH', false, '  direct, aggressive, vulgar  ')
    expect(policy).toContain('"direct, aggressive, vulgar"')
    expect(policy).toContain('an explicit tone in the article assignment takes precedence')
    expect(policy).toContain('profanity alone is neither a factual allegation nor evidence of an intent')
    expect(editorialPolicy('opinion', 'HIGH', false, '  ')).not.toContain('Requested tone of voice')
  })

  it.each(['opinion', 'story'] as const)('keeps HIGH %s forceful through editorial review', (format) => {
    const policy = editorialPolicy(format, 'HIGH', true, 'biting, sarcastic')
    expect(policy).toContain('Deliberately confrontational writing is part of this assignment')
    expect(policy).toContain('Do not add mandatory balancing paragraphs')
    expect(policy).toContain('Correct only the defective factual premise')
    expect(policy).toContain('assignment_mismatch')
  })

  it('reserves the confrontational directive for HIGH opinion and story', () => {
    for (const policy of [
      editorialPolicy('opinion', 'LOW'),
      editorialPolicy('story', 'MEDIUM'),
      editorialPolicy('news', 'HIGH'),
    ])
      expect(policy).not.toContain('Deliberately confrontational writing is part of this assignment')
  })

  it.each([
    ['NONE', 'attribute it to its source once'],
    ['LOW', 'attribute it to its source once'],
    ['MEDIUM', 'as a condition, not as a separate caveat'],
    ['HIGH', 'never as a hedge that softens the position'],
  ])('tunes uncertainty for %s controversy', (level, expected) => {
    expect(editorialPolicy('analysis', level)).toContain(expected)
  })
})

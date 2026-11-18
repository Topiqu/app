import { describe, expect, it } from 'vitest'

import { editorialPolicy, topicFormatsFor } from '../../../server/utils/ai/editorialPolicy'

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
    expect(policy).toContain('sarcasm, satire, ridicule, anger and rhetorical hyperbole')
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
    expect(policy).toContain('tone_mismatch')
  })

  it('sends unrequested softening of a HIGH opinion to revision instead of blocking it', () => {
    const policy = editorialPolicy('opinion', 'HIGH')
    expect(policy).toContain('unrequested softening of this voice is tone_mismatch, which the revision restores')
    expect(policy).not.toContain('blocking assignment_mismatch')
  })

  it.each(['analysis', 'comparison'] as const)('makes a HIGH %s argue a thesis and blocks a neutral one', (format) => {
    const policy = editorialPolicy(format, 'HIGH', false, 'sarcastic')
    expect(policy).toContain('This piece argues a position')
    expect(policy).toContain('a draft that drops the thesis into a neutral explainer is assignment_mismatch')
    expect(policy).toContain('keeps the thesis but loses the requested tone is tone_mismatch')
    expect(policy).not.toContain('Deliberately confrontational writing is part of this assignment')
  })

  it('carries the publisher tone into every format without ritual concessions', () => {
    for (const format of ['news', 'guide', 'opinion'] as const) {
      const policy = editorialPolicy(format, 'HIGH', false, 'sarcastic')
      expect(policy).toContain('Deliver this tone in every format')
      expect(policy).toContain('do not soften it with balancing paragraphs or ritual concessions')
    }
    expect(editorialPolicy('news', 'HIGH', false, 'sarcastic')).toContain(
      'A requested tone of voice still shapes the framing, word choice and commentary',
    )
  })

  it.each(['MEDIUM', 'HIGH'] as const)(
    'gives %s a practitioner voice in every format, without a format escape hatch',
    (level) => {
      for (const format of ['news', 'guide', 'analysis'] as const) {
        const policy = editorialPolicy(format, level)
        expect(policy).toContain('experienced practitioner')
        expect(policy).toContain('The voice shows in every format')
        expect(policy).toContain('a textbook register at this level')
        expect(policy).not.toContain('where the format allows it')
        expect(policy).not.toContain('Engage with a serious counterargument')
        // The writer's rules ban a closing Verdict section, so the voice must not ask for one.
        expect(policy).not.toContain('final verdict')
      }
    },
  )

  it('keeps MEDIUM below HIGH: irony yes, ridicule only when the tone asks', () => {
    expect(editorialPolicy('guide', 'MEDIUM')).toContain('Ridicule, hyperbole and profanity belong to HIGH')
    expect(editorialPolicy('guide', 'HIGH')).toContain(
      'Irony, sarcasm, satire, ridicule, anger and rhetorical hyperbole are the main tools',
    )
  })

  it.each(['NONE', 'LOW'] as const)(
    'keeps %s from arguing in every format, and never about the article itself',
    (level) => {
      const policy = editorialPolicy('guide', level)
      expect(policy).toContain(level === 'NONE' ? 'Use a restrained explanatory voice' : 'Use a measured voice')
      expect(policy).not.toContain('The voice shows in every format')
      expect(policy).toContain('Never describe the article to the reader')
    },
  )

  // The default level: how company blogs write, a practitioner who recommends without a polemic.
  it('gives LOW a practitioner voice that says which option suits whom, and NONE a restrained one', () => {
    const low = editorialPolicy('guide', 'LOW')
    expect(low).toContain('an experienced practitioner talking to a peer')
    expect(low).toContain('say which option suits whom, what to avoid and why')
    expect(low).toContain('irony only when the requested tone asks for it')
    expect(low).toContain('a comparison of options that never says which suits whom')
    expect(editorialPolicy('guide', 'NONE')).not.toContain('experienced practitioner')
  })

  it('keeps the thesis directive off news, guides and lower levels', () => {
    for (const policy of [
      editorialPolicy('news', 'HIGH'),
      editorialPolicy('guide', 'HIGH'),
      editorialPolicy('analysis', 'MEDIUM'),
      editorialPolicy('opinion', 'HIGH'),
    ])
      expect(policy).not.toContain('This piece argues a position')
  })

  it('reserves the confrontational directive for HIGH opinion and story', () => {
    for (const policy of [
      editorialPolicy('opinion', 'LOW'),
      editorialPolicy('story', 'MEDIUM'),
      editorialPolicy('news', 'HIGH'),
    ])
      expect(policy).not.toContain('Deliberately confrontational writing is part of this assignment')
  })

  it.each([null, undefined, '', 'low', 'arbitrary'])('reads %j as LOW, never as a generic voice', (level) => {
    const policy = editorialPolicy('guide', level)
    expect(policy).toContain('Use a measured voice')
    expect(policy).toContain('a recommendation the facts support is not')
    expect(policy).not.toContain('Use the requested authorial voice')
  })

  it.each([
    [
      'NONE',
      'a verdict, a pick between options, polemic or irony that neither the assignment, the format nor the requested tone',
    ],
    ['LOW', 'polemic, ridicule or irony that neither the assignment, the format nor the requested tone'],
    ['MEDIUM', 'a piece that never says which side it takes, or one without a single ironic line, is tone_mismatch'],
    ['HIGH', 'a concession that gives the position away, or a piece that reads measured'],
  ])('reports a %s voice missed in its own direction as tone_mismatch', (level, expected) => {
    expect(editorialPolicy('analysis', level)).toContain(expected)
  })

  it.each(['NONE', 'LOW'] as const)('lets an explicit stance or an opinion format override %s restraint', (level) => {
    expect(editorialPolicy('opinion', level)).toContain(
      'An explicit stance in the assignment, or an opinion format, overrides this restraint',
    )
  })

  it('lets a NONE guide give its steps but leave the choice to the reader', () => {
    expect(editorialPolicy('guide', 'NONE')).toContain(
      'a guide gives the steps and the criteria but never says which option to pick',
    )
    expect(editorialPolicy('guide', 'NONE')).toContain('the steps and criteria of a guide are not a verdict')
    expect(editorialPolicy('guide', 'LOW')).toContain('say so plainly and recommend it')
  })

  // The eval read every HIGH piece as LOW or MEDIUM: no irony anywhere and topic titles.
  it('asks HIGH for a thesis title and a sharp line per section, outside news', () => {
    const policy = editorialPolicy('analysis', 'HIGH')
    expect(policy).toContain('The title states a provocative thesis as a flat claim, not the topic and never hedged')
    expect(policy).toContain('answer at least one common objection with sarcasm')
    expect(policy).toContain('hedging its thesis with can or may')
    expect(policy).toContain('never as a hedge that softens the position, and never in the title')
    expect(policy).toContain('Outside news, every section carries at least one sharp line')
    expect(policy).toContain('unless the assignment asks for restraint')
    expect(editorialPolicy('analysis', 'MEDIUM')).toContain('name the side in the title or perex')
    // The second eval read every MEDIUM piece as LOW: guides took no side and no piece had an ironic line.
    expect(editorialPolicy('guide', 'MEDIUM')).toContain(
      'in a guide through the approach it stands for, named in the title or perex',
    )
    expect(editorialPolicy('guide', 'MEDIUM')).toContain('at least one dry, ironic line in the piece')
  })

  it('carries requested profanity through the piece', () => {
    expect(editorialPolicy('opinion', 'HIGH', false, 'vulgar')).toContain(
      'a tone that asks for profanity carries it through the piece, not as a word or two in otherwise clean prose',
    )
  })

  it('keeps the tone on the wording and the level on the strength of the position', () => {
    expect(editorialPolicy('guide', 'NONE', false, 'sarcastic')).toContain(
      'The tone shapes the wording; how strongly the article takes a side follows the controversy level above',
    )
  })

  it.each([
    ['NONE', 'do not choose opinion'],
    ['MEDIUM', 'Opinion suits this blog'],
    ['HIGH', 'Prefer opinion whenever the topic holds a position worth defending'],
  ])('gives the topic picker a %s format preference', (level, expected) => {
    expect(topicFormatsFor(level)).toContain(expected)
  })

  it('leaves the topic picker free at LOW and for an unset level', () => {
    expect(topicFormatsFor('LOW')).toBeUndefined()
    expect(topicFormatsFor(null)).toBeUndefined()
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

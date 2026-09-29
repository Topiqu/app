import { describe, expect, it } from 'vitest'

import { editorialPolicy } from '../../../server/utils/ai/editorialPolicy'

describe('editorial policy', () => {
  it('limits statements about missing evidence to corrections, reported status and conflicts', () => {
    expect(editorialPolicy('analysis', 'LOW')).toContain('Write about the topic, never about the research behind it')
  })

  it('allows an invented illustrative story only when the author asks for it in the editor', () => {
    expect(editorialPolicy('story', 'LOW', true)).toContain('illustrative narrative')
    const unattended = editorialPolicy('story', 'LOW')
    expect(unattended).not.toContain('illustrative narrative')
    expect(unattended).toContain('Never invent a protagonist, scene or event')
    expect(editorialPolicy('analysis', 'LOW')).not.toContain('Never invent a protagonist')
  })

  it('narrates a story in scenes instead of arguing a thesis', () => {
    expect(editorialPolicy('story', 'LOW')).toContain('sequence of scenes, in the past tense')
    expect(editorialPolicy('story', 'LOW')).not.toContain('central question or thesis')
    expect(editorialPolicy('analysis', 'LOW')).toContain('central question or thesis')
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

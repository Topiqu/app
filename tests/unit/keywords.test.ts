import { describe, expect, it } from 'vitest'

import { addKeywords } from '../../app/utils/keywords'

describe('addKeywords', () => {
  it('appends a trimmed keyword', () => {
    expect(addKeywords(['rpg'], '  unreal engine ')).toEqual(['rpg', 'unreal engine'])
  })

  it('splits a pasted comma list', () => {
    expect(addKeywords([], 'rpg, unreal engine,, ai')).toEqual(['rpg', 'unreal engine', 'ai'])
  })

  it('dedupes case-insensitively, within the entry and against the list', () => {
    expect(addKeywords(['RPG'], 'rpg, ai, AI')).toEqual(['RPG', 'ai'])
  })

  // The component skips the emit on identity, which keeps the settings form from going dirty
  // when a blur commits an empty or fully duplicate entry.
  it('returns the original array when nothing is added', () => {
    const current = ['rpg']
    expect(addKeywords(current, '   ')).toBe(current)
    expect(addKeywords(current, 'RPG')).toBe(current)
  })
})

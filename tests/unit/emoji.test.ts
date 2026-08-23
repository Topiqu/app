import { describe, expect, it } from 'vitest'

import { isValidEmojiShortcode, normalizeEmojiShortcode } from '../../shared/utils/emoji'

describe('emoji shortcodes', () => {
  it('derives a safe lowercase shortcode from an uploaded filename', () => {
    expect(normalizeEmojiShortcode('Příliš Žluťoučký Kůň.PNG')).toBe('prilis-zlutoucky-kun')
  })

  it('collapses separators and strips surrounding punctuation', () => {
    expect(normalizeEmojiShortcode('__Party   Parrot--.gif')).toBe('party-parrot')
  })

  it('caps names at the database limit', () => {
    expect(normalizeEmojiShortcode('a'.repeat(80))).toHaveLength(50)
  })

  it('accepts only canonical shortcodes', () => {
    expect(isValidEmojiShortcode('party_parrot-2')).toBe(true)
    expect(isValidEmojiShortcode('Party Parrot')).toBe(false)
    expect(isValidEmojiShortcode('-party-')).toBe(false)
    expect(isValidEmojiShortcode('')).toBe(false)
  })
})

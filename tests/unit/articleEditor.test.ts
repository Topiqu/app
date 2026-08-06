import { describe, expect, it } from 'vitest'

import {
  AI_FORMATS,
  composeAiPrompt,
  countHtmlWords,
  formatElapsed,
  releaseQuickValue,
  toDateTimeLocal,
} from '../../shared/utils/articleEditor'

describe('composeAiPrompt', () => {
  it('returns the bare topic when no format is selected', () => {
    expect(composeAiPrompt('  Nuxt 4 migration  ')).toBe('Nuxt 4 migration')
    expect(composeAiPrompt('Nuxt 4 migration', null)).toBe('Nuxt 4 migration')
  })

  it('prefixes the topic with the selected format template', () => {
    expect(composeAiPrompt('Nuxt 4 migration', 'Write a practical step-by-step guide about:')).toBe(
      'Write a practical step-by-step guide about: Nuxt 4 migration',
    )
  })

  it('never emits a dangling separator when one side is empty', () => {
    expect(composeAiPrompt('', 'Write a news report about:')).toBe('Write a news report about:')
    expect(composeAiPrompt('   ', '   ')).toBe('')
  })

  it('exposes a stable, non-empty format list', () => {
    expect(AI_FORMATS.length).toBeGreaterThan(0)
    expect(new Set(AI_FORMATS).size).toBe(AI_FORMATS.length)
  })
})

describe('countHtmlWords', () => {
  it('counts words in streamed markup, not tags', () => {
    expect(countHtmlWords('<h2>Hello there</h2><p>Three more words</p>')).toBe(5)
  })

  it('treats entities and whitespace as separators', () => {
    expect(countHtmlWords('<p>one&nbsp;two</p>\n\n<p>  three  </p>')).toBe(3)
  })

  it('ignores script and style content', () => {
    expect(countHtmlWords('<style>.a{color:red}</style><p>only this</p>')).toBe(2)
  })

  it('handles empty input', () => {
    expect(countHtmlWords('')).toBe(0)
    expect(countHtmlWords(null)).toBe(0)
    expect(countHtmlWords(undefined)).toBe(0)
  })
})

describe('formatElapsed', () => {
  it('formats as m:ss with a zero-padded seconds field', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(9_400)).toBe('0:09')
    expect(formatElapsed(65_000)).toBe('1:05')
    expect(formatElapsed(600_000)).toBe('10:00')
  })

  it('clamps negative drift to zero', () => {
    expect(formatElapsed(-5_000)).toBe('0:00')
  })
})

describe('toDateTimeLocal', () => {
  it('returns null for empty values', () => {
    expect(toDateTimeLocal(null)).toBeNull()
    expect(toDateTimeLocal(undefined)).toBeNull()
    expect(toDateTimeLocal('')).toBeNull()
  })

  it('truncates an existing input string to minute precision', () => {
    expect(toDateTimeLocal('2026-08-06T14:05:33.000Z')).toBe('2026-08-06T14:05')
  })

  it('renders a Date in local time, not UTC', () => {
    const date = new Date(2026, 7, 6, 14, 5)
    expect(toDateTimeLocal(date)).toBe('2026-08-06T14:05')
  })
})

describe('releaseQuickValue', () => {
  const from = new Date(2026, 7, 6, 14, 5, 33)

  it('clears the release date', () => {
    expect(releaseQuickValue('clear', from)).toBeNull()
  })

  it('drops seconds so the datetime-local input round-trips', () => {
    expect(releaseQuickValue('now', from)).toBe('2026-08-06T14:05')
  })

  it('adds an hour', () => {
    expect(releaseQuickValue('inHour', from)).toBe('2026-08-06T15:05')
  })

  it('moves to 8:00 the next day', () => {
    expect(releaseQuickValue('tomorrow', from)).toBe('2026-08-07T08:00')
  })

  it('does not mutate the source date', () => {
    const source = new Date(2026, 7, 6, 14, 5, 33)
    releaseQuickValue('tomorrow', source)
    expect(source.getDate()).toBe(6)
    expect(source.getSeconds()).toBe(33)
  })
})

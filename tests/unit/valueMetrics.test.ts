import { describe, expect, it } from 'vitest'

import {
  completedWritingValue,
  contributesToValue,
  countGeneratedWords,
  generatedWordsFromSnapshot,
  selectWritingEstimate,
} from '../../shared/utils/valueMetrics'

describe('completed writing value', () => {
  it('counts visible words rather than markup or image attributes', () => {
    expect(countGeneratedWords('<h2>Český nadpis</h2><p>Text o&nbsp;práci <img src="/x" alt="hidden words"></p>')).toBe(
      5,
    )
  })

  it('ignores missing or partial snapshots', () => {
    expect(generatedWordsFromSnapshot(null)).toBe(0)
    expect(generatedWordsFromSnapshot({ title: 'Unfinished' })).toBe(0)
  })

  it('returns no fabricated value for empty work', () => {
    expect(completedWritingValue(0, 60, 400)).toMatchObject({
      generatedWords: 0,
      estimatedMinutes: 0,
      estimatedAmountUsd: 0,
      breakdown: [],
    })
  })

  it('derives time and money from the same completed word count', () => {
    expect(completedWritingValue(800, 60, 400)).toMatchObject({
      generatedWords: 800,
      estimatedMinutes: 120,
      estimatedAmountUsd: 120,
      breakdown: [{ activity: 'writing', words: 800, minutes: 120 }],
    })
  })

  it('revalues completed work when the site rate changes without changing its word count', () => {
    const before = completedWritingValue(400, 35, 400)
    const after = completedWritingValue(400, 70, 400)
    expect(after.estimatedMinutes).toBe(before.estimatedMinutes)
    expect(after.estimatedAmountUsd).toBe(before.estimatedAmountUsd * 2)
  })

  it('does not treat merely detected issues as completed value', () => {
    expect(contributesToValue('detected')).toBe(false)
    expect(contributesToValue('accepted')).toBe(true)
    expect(contributesToValue('resolved')).toBe(true)
    expect(contributesToValue('completed')).toBe(true)
  })

  it('shows a historical article estimate only for all time and never adds it to documented work', () => {
    const documented = completedWritingValue(100, 35, 400)
    const legacy = completedWritingValue(774, 35, 400)
    expect(selectWritingEstimate(completedWritingValue(0, 35, 400), legacy, true)).toMatchObject({
      basis: 'legacy',
      value: { generatedWords: 774 },
    })
    expect(selectWritingEstimate(completedWritingValue(0, 35, 400), legacy, false)).toEqual({
      basis: 'none',
      value: null,
    })
    expect(selectWritingEstimate(documented, legacy, true)).toMatchObject({
      basis: 'documented',
      value: { generatedWords: 100 },
    })
  })
})

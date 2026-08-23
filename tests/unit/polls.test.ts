import { describe, expect, it } from 'vitest'

import { normalizePollOptions, pollOptionsAttr } from '../../shared/utils/polls'

describe('normalizePollOptions', () => {
  it('keeps the id/label shape and the legacy plain-string shape', () => {
    expect(normalizePollOptions([{ id: 'o1', label: 'Ano' }])).toEqual([{ id: 'o1', label: 'Ano' }])
    expect(normalizePollOptions(['Ano', 'Ne'])).toEqual([{ label: 'Ano' }, { label: 'Ne' }])
  })

  it('drops entries whose label is empty or not a string', () => {
    expect(normalizePollOptions([{ id: 'o1', label: '  ' }, { label: 'Ne' }, { id: 'o3' }, null])).toEqual([
      { label: 'Ne' },
    ])
  })

  it('never returns an empty array', () => {
    expect(normalizePollOptions([])).toHaveLength(1)
    expect(normalizePollOptions('nonsense')).toHaveLength(1)
  })
})

describe('pollOptionsAttr', () => {
  const options = [
    { id: 'o1', label: 'Do 30 faktur měsíčně' },
    { id: 'o2', label: '30–100 faktur měsíčně' },
  ]

  it('carries the option ids through — a vote keys off them', () => {
    expect(JSON.parse(pollOptionsAttr(options, 'Možnost 1'))).toEqual(options)
  })

  it('never stringifies an option object into its label', () => {
    // The regression: `String({id, label})` wrote "[object Object]" over every label and
    // orphaned the ids, so ArticlePoll rendered buttons that could not be voted on.
    expect(pollOptionsAttr(options, 'Možnost 1')).not.toContain('[object Object]')
  })

  it('is idempotent, so a keystroke does not re-dirty an already normalized block', () => {
    const once = pollOptionsAttr(options, 'Možnost 1')
    expect(pollOptionsAttr(JSON.parse(once), 'Možnost 1')).toBe(once)
  })

  it('falls back to the caller-supplied label only when there is nothing to normalize', () => {
    expect(pollOptionsAttr([], 'Možnost 1')).toBe(JSON.stringify([{ label: 'Možnost 1' }]))
    expect(pollOptionsAttr(null, 'Option 1')).toBe(JSON.stringify([{ label: 'Option 1' }]))
  })

  it('upgrades the legacy string shape without inventing ids', () => {
    expect(JSON.parse(pollOptionsAttr(['Ano', 'Ne'], 'Možnost 1'))).toEqual([{ label: 'Ano' }, { label: 'Ne' }])
  })
})

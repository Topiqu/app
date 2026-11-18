import { describe, expect, it } from 'vitest'

import { controversyLevelOf, isControversyLevel } from '../../shared/utils/controversyLevel'

describe('controversy level', () => {
  it.each([
    ['NONE', 'NONE'],
    ['HIGH', 'HIGH'],
    ['medium', 'MEDIUM'],
    [null, 'LOW'],
    [undefined, 'LOW'],
    ['', 'LOW'],
    ['EXTREME', 'LOW'],
    [3, 'LOW'],
  ])('reads %j as %s', (value, level) => {
    expect(controversyLevelOf(value)).toBe(level)
  })

  it('accepts only the stored spelling of a level', () => {
    expect(isControversyLevel('LOW')).toBe(true)
    expect(isControversyLevel('low')).toBe(false)
    expect(isControversyLevel(null)).toBe(false)
  })
})

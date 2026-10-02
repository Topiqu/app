import { describe, expect, it } from 'vitest'
import { seriesProgress } from '~~/shared/utils/seriesProgress'

const parts = ['a', 'b', 'c'].map((id) => ({ id, slug: id, title: id.toUpperCase() }))

describe('seriesProgress', () => {
  it('starts at the first part for a new reader', () => {
    expect(seriesProgress(parts, new Set())).toEqual({ read: 0, next: parts[0] })
  })

  it('continues with the first unread part, even if a later one was read out of order', () => {
    expect(seriesProgress(parts, new Set(['a', 'c']))).toEqual({ read: 2, next: parts[1] })
  })

  it('has no next part once everything is read', () => {
    expect(seriesProgress(parts, new Set(['a', 'b', 'c']))).toEqual({ read: 3, next: null })
  })
})

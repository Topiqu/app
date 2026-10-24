import { describe, expect, it } from 'vitest'
import { seriesNavigation, seriesProgress } from '~~/shared/utils/seriesProgress'

const parts = ['a', 'b', 'c'].map((id) => ({ id, slug: id, title: id.toUpperCase() }))

describe('seriesProgress', () => {
  it('numbers the available parts consecutively even when stored positions have gaps', () => {
    const visible = [
      { ...parts[0]!, seriesOrder: 2 },
      { ...parts[2]!, seriesOrder: 7 },
    ]
    expect(seriesNavigation(visible, 'c')).toMatchObject({
      current: 2,
      total: 2,
      prev: { id: 'a', seriesOrder: 1 },
      next: null,
      articles: [
        { id: 'a', seriesOrder: 1 },
        { id: 'c', seriesOrder: 2 },
      ],
    })
  })

  it('does not advertise a current part that is absent from the public list', () => {
    expect(seriesNavigation(parts, 'draft')).toBeNull()
    expect(seriesNavigation([], 'a')).toBeNull()
  })
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

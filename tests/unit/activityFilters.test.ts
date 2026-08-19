import { describe, expect, it } from 'vitest'

import { compareBySort, matchesFilters, type SortableEntry } from '../../app/utils/activityFilters'

const entry = (overrides: Partial<SortableEntry> = {}): SortableEntry => ({
  createdAt: '2026-01-01T00:00:00.000Z',
  likesCount: 0,
  ...overrides,
})

describe('matchesFilters', () => {
  it('matches the query case-insensitively', () => {
    expect(matchesFilters('Unreal Engine', [], 'unreal', [])).toBe(true)
    expect(matchesFilters('unreal engine', [], 'UNREAL', [])).toBe(true)
    expect(matchesFilters('Unreal Engine', [], 'godot', [])).toBe(false)
  })

  it('keeps everything while no tag is selected', () => {
    expect(matchesFilters('anything', [], '', [])).toBe(true)
  })

  // Selected tags narrow the list: an entry has to carry all of them, not just one.
  it('requires every selected tag, not any of them', () => {
    expect(matchesFilters('post', ['ai', 'seo'], '', ['ai', 'seo'])).toBe(true)
    expect(matchesFilters('post', ['ai'], '', ['ai', 'seo'])).toBe(false)
  })

  it('applies query and tags together', () => {
    expect(matchesFilters('AI post', ['ai'], 'post', ['ai'])).toBe(true)
    expect(matchesFilters('AI post', ['ai'], 'video', ['ai'])).toBe(false)
  })
})

describe('compareBySort', () => {
  const older = entry({ createdAt: '2026-01-01T00:00:00.000Z', likesCount: 1, views: 10 })
  const newer = entry({ createdAt: '2026-06-01T00:00:00.000Z', likesCount: 5, views: 2 })

  it('sorts newest first by default order', () => {
    expect([older, newer].sort(compareBySort('createdAt:desc'))).toEqual([newer, older])
  })

  it('sorts oldest first when asked ascending', () => {
    expect([newer, older].sort(compareBySort('createdAt:asc'))).toEqual([older, newer])
  })

  it('sorts by likes and by views independently of the date', () => {
    expect([older, newer].sort(compareBySort('likes:desc'))).toEqual([newer, older])
    expect([newer, older].sort(compareBySort('views:desc'))).toEqual([older, newer])
  })

  it('treats a missing date as the epoch instead of NaN-sorting the list', () => {
    const undated = entry({ createdAt: null, likesCount: 0 })
    expect([undated, newer].sort(compareBySort('createdAt:desc'))).toEqual([newer, undated])
  })

  it('treats a missing view count as zero', () => {
    const unseen = entry({ views: undefined })
    expect([unseen, older].sort(compareBySort('views:desc'))).toEqual([older, unseen])
  })
})

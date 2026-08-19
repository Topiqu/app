import { describe, expect, it } from 'vitest'

import { hasProfileChanges } from '../../app/utils/profileChanges'

const profile = (overrides: Record<string, unknown> = {}) => ({
  username: 'Vojta',
  bio: null,
  avatarUrl: null,
  handle: 'vojta',
  sessions: [],
  ...overrides,
})

describe('hasProfileChanges', () => {
  it('reports no change for an untouched form', () => {
    expect(hasProfileChanges(profile(), profile())).toBe(false)
  })

  it('reports a real edit', () => {
    expect(hasProfileChanges(profile({ bio: 'hello' }), profile())).toBe(true)
    expect(hasProfileChanges(profile({ username: 'Someone' }), profile())).toBe(true)
  })

  // Type into an empty bio, then delete it again: the input holds '' while the column holds null.
  it('treats a cleared input as equal to a column that was never set', () => {
    expect(hasProfileChanges(profile({ bio: '' }), profile({ bio: null }))).toBe(false)
    expect(hasProfileChanges(profile({ avatarUrl: '' }), profile({ avatarUrl: null }))).toBe(false)
  })

  it('still sees clearing a field that had a value', () => {
    expect(hasProfileChanges(profile({ bio: '' }), profile({ bio: 'was here' }))).toBe(true)
  })

  it('ignores sessions, which are revoked server-side rather than saved', () => {
    expect(hasProfileChanges(profile({ sessions: [{ id: 'a' }] }), profile({ sessions: [] }))).toBe(false)
  })

  // `handle` is derived from `username`; after saving a rename the two copies disagree for a tick.
  it('ignores a stale derived handle', () => {
    expect(
      hasProfileChanges(profile({ username: 'New Name', handle: 'vojta' }), profile({ username: 'New Name' })),
    ).toBe(false)
  })

  it('treats a missing original as changed once anything is filled in', () => {
    expect(hasProfileChanges(profile({ bio: 'hello' }), null)).toBe(true)
  })
})

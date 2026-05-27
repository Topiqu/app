import { describe, expect, it } from 'vitest'

import { POLL_MAX_BATCH, buildPollFindArgs, buildUnreadCountArgs } from '../../../server/utils/notificationsPoll'

const USER = 'user-1'

describe('buildPollFindArgs', () => {
  it('returns null without a cursor (client already has the full list)', () => {
    expect(buildPollFindArgs(USER, undefined)).toBeNull()
  })

  it('filters strictly newer than the cursor, scoped to the user and non-deleted', () => {
    const since = new Date('2026-05-27T10:00:00.000Z')
    const args = buildPollFindArgs(USER, since)

    expect(args?.where).toEqual({
      userId: USER,
      deletedAt: null,
      createdAt: { gt: since },
    })
  })

  it('caps the batch and orders newest first', () => {
    const args = buildPollFindArgs(USER, new Date())

    expect(args?.take).toBe(POLL_MAX_BATCH)
    expect(args?.orderBy).toEqual({ createdAt: 'desc' })
  })

  it('includes the related article for rendering', () => {
    const args = buildPollFindArgs(USER, new Date())

    expect(args?.include).toEqual({ article: { select: { title: true, slug: true } } })
  })
})

describe('buildUnreadCountArgs', () => {
  it('counts only unread, non-deleted notifications for the user', () => {
    expect(buildUnreadCountArgs(USER).where).toEqual({
      userId: USER,
      isRead: false,
      deletedAt: null,
    })
  })
})

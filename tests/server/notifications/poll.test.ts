import { describe, expect, it } from 'vitest'

import {
  POLL_MAX_BATCH,
  buildPollFindArgs,
  buildUnreadCountArgs,
  notificationCursor,
} from '../../../server/utils/notificationsPoll'

const USER = 'user-1'

describe('buildPollFindArgs', () => {
  it('bootstraps new notifications even when the initial list was empty', () => {
    const args = buildPollFindArgs(USER, undefined)
    expect(args.where).toEqual({ userId: USER, deletedAt: null })
    expect(args.take).toBe(POLL_MAX_BATCH)
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
    expect(args?.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }])
  })

  it('includes the related article for rendering', () => {
    const args = buildPollFindArgs(USER, new Date())

    expect(args?.include).toEqual({ article: { select: { title: true, slug: true, language: true, imageUrl: true } } })
  })

  it('drains every batch in stable ascending order and retains equal-timestamp notifications', () => {
    const since = new Date('2026-10-24T10:00:00Z')
    const args = buildPollFindArgs(USER, since, 'notification-25')
    expect(args.where).toEqual({
      userId: USER,
      deletedAt: null,
      OR: [{ createdAt: { gt: since } }, { createdAt: since, id: { gt: 'notification-25' } }],
    })
    expect(args.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }])
    expect(args.take).toBe(25)
  })

  it('seeds an empty list with the server read time rather than the browser clock', () => {
    const startedAt = new Date('2026-10-24T10:00:00Z')
    expect(notificationCursor(undefined, startedAt)).toEqual({ createdAt: startedAt.toISOString(), id: '' })
    expect(buildPollFindArgs(USER, startedAt, '').where).toMatchObject({
      OR: [{ createdAt: { gt: startedAt } }, { createdAt: startedAt, id: { gt: '' } }],
    })
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

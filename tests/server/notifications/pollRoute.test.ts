import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildPollFindArgs,
  buildUnreadCountArgs,
  notificationCursor,
  POLL_MAX_BATCH,
} from '../../../server/utils/notificationsPoll'

const findMany = vi.fn()
const count = vi.fn()
const session = vi.fn()
let query: Record<string, string>

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-24T10:10:00.000Z'))
  query = {}
  findMany.mockReset().mockResolvedValue([])
  count.mockReset().mockResolvedValue(0)
  session.mockReset().mockResolvedValue({ id: 'viewer' })
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('useServerI18n', async () => ({ translate: () => 'Unauthorized' }))
  vi.stubGlobal('getSessionUser', session)
  vi.stubGlobal('getEnhancedPrisma', async () => ({ notification: { findMany, count } }))
  vi.stubGlobal('getValidatedQuery', async (_event: unknown, parse: (query: unknown) => unknown) => parse(query))
  vi.stubGlobal('buildPollFindArgs', buildPollFindArgs)
  vi.stubGlobal('buildUnreadCountArgs', buildUnreadCountArgs)
  vi.stubGlobal('notificationCursor', notificationCursor)
  vi.stubGlobal('POLL_MAX_BATCH', POLL_MAX_BATCH)
  vi.stubGlobal('createError', createError)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
const poll = async () => {
  const handler = (await import('../../../server/api/notifications/poll.get')).default
  return handler({} as never)
}

describe('notification cursor delivery', () => {
  it('returns a cursor even when there are no notifications', async () => {
    await expect(poll()).resolves.toMatchObject({
      notifications: [],
      cursor: { createdAt: '2026-10-24T10:10:00.000Z', id: '' },
      hasMore: false,
    })
    expect(findMany.mock.calls[0]![0].where).toMatchObject({ userId: 'viewer', deletedAt: null })
  })

  it('advances to the last delivered notification so the following batch cannot be skipped', async () => {
    query = { since: '2026-10-24T10:00:00.000Z', sinceId: '' }
    const rows = Array.from({ length: 25 }, (_, index) => ({
      id: `notification-${String(index).padStart(2, '0')}`,
      createdAt: new Date(query.since!),
    }))
    findMany.mockResolvedValue(rows)
    count.mockResolvedValue(28)
    await expect(poll()).resolves.toMatchObject({
      unreadCount: 28,
      cursor: { createdAt: query.since, id: 'notification-24' },
      hasMore: true,
    })
  })

  it('does not move a quiet cursor forward to server time', async () => {
    query = { since: '2026-10-24T10:00:00.000Z', sinceId: 'notification-24' }
    await expect(poll()).resolves.toMatchObject({ cursor: { createdAt: query.since, id: query.sinceId } })
  })

  it('rejects unauthenticated reads before querying any notifications', async () => {
    session.mockResolvedValue(null)
    await expect(poll()).rejects.toMatchObject({ statusCode: 401 })
    expect(findMany).not.toHaveBeenCalled()
  })
})

import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildUnreadCountArgs } from '../../../server/utils/notificationsPoll'

const updateMany = vi.fn()
const count = vi.fn()
const session = vi.fn()
const before = '2026-11-06T10:00:00.000Z'
let body: unknown

beforeEach(() => {
  vi.resetModules()
  body = { before }
  updateMany.mockReset().mockResolvedValue({ count: 2 })
  count.mockReset().mockResolvedValue(1)
  session.mockReset().mockResolvedValue({ id: 'viewer' })
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('useServerI18n', async () => ({ translate: () => 'Unauthorized' }))
  vi.stubGlobal('getSessionUser', session)
  vi.stubGlobal('getEnhancedPrisma', async () => ({ notification: { updateMany, count } }))
  vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (input: unknown) => unknown) => parse(body))
  vi.stubGlobal('buildUnreadCountArgs', buildUnreadCountArgs)
  vi.stubGlobal('createError', createError)
})
afterEach(() => vi.unstubAllGlobals())

const markRead = async () => {
  const handler = (await import('../../../server/api/notifications/read.post')).default
  return handler({} as never)
}

describe('marking notifications as read', () => {
  it('marks only the viewer’s seen notifications and returns what is left', async () => {
    await expect(markRead()).resolves.toEqual({ unreadCount: 1 })
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'viewer', isRead: false, deletedAt: null, createdAt: { lte: new Date(before) } },
      data: { isRead: true },
    })
    expect(count.mock.calls[0]![0].where).toMatchObject({ userId: 'viewer', isRead: false, deletedAt: null })
  })

  it('rejects guests before touching any notification', async () => {
    session.mockResolvedValue(null)
    await expect(markRead()).rejects.toMatchObject({ statusCode: 401 })
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('rejects a body without a valid cutoff', async () => {
    body = { before: 'not-a-date' }
    await expect(markRead()).rejects.toBeTruthy()
    body = {}
    await expect(markRead()).rejects.toBeTruthy()
    expect(updateMany).not.toHaveBeenCalled()
  })
})

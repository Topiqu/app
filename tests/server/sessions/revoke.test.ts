import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const actor = { id: 'account-1', sessionId: 'current-session', clientSiteId: 'tenant-1' }
const remove = vi.fn()
const audit = vi.fn()
const report = vi.fn()
const rateLimit = vi.fn()
const authenticate = vi.fn()
const originCheck = vi.fn()
const enhanced = vi.fn()

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('requireUser', authenticate)
  vi.stubGlobal('requireSameAuthOrigin', originCheck)
  vi.stubGlobal('consumeRateLimit', rateLimit)
  vi.stubGlobal('getEnhancedPrisma', enhanced)
  vi.stubGlobal('getRouterParam', () => 'other-session')
  vi.stubGlobal('getIp', () => '203.0.113.4')
  vi.stubGlobal('logAction', audit)
  vi.stubGlobal('reportCaughtError', report)
  authenticate.mockResolvedValue(actor)
  originCheck.mockImplementation(() => {})
  enhanced.mockResolvedValue({ session: { deleteMany: remove } })
  rateLimit.mockResolvedValue(true)
  remove.mockResolvedValue({ count: 3 })
  audit.mockResolvedValue(undefined)
  report.mockResolvedValue(undefined)
})
afterEach(() => vi.unstubAllGlobals())

describe('DELETE /api/sessions/others', () => {
  const handler = async () => (await import('../../../server/api/sessions/others.delete')).default

  it('revokes only the account’s other sessions across all tenants and domains', async () => {
    await expect((await handler())({} as never)).resolves.toEqual({ success: true, count: 3 })
    expect(enhanced).toHaveBeenCalledWith(actor)
    expect(remove).toHaveBeenCalledWith({ where: { userId: actor.id, id: { not: actor.sessionId } } })
    expect(rateLimit).toHaveBeenCalledWith('session-revoke:account-1', 20, 60)
    expect(audit).toHaveBeenCalledWith({
      action: 'SESSIONS_REVOKE_OTHERS',
      userId: actor.id,
      ip: '203.0.113.4',
      metadata: { count: 3 },
    })
  })

  it('rejects unauthenticated requests before any session access', async () => {
    authenticate.mockRejectedValue(createError({ statusCode: 401 }))
    await expect((await handler())({} as never)).rejects.toMatchObject({ statusCode: 401 })
    expect(remove).not.toHaveBeenCalled()
    expect(enhanced).not.toHaveBeenCalled()
  })

  it('fails closed when the current session ID is missing', async () => {
    authenticate.mockResolvedValue({ ...actor, sessionId: undefined })
    await expect((await handler())({} as never)).rejects.toMatchObject({ statusCode: 401 })
    expect(remove).not.toHaveBeenCalled()
  })

  it('rejects cross-origin requests before reading or deleting sessions', async () => {
    originCheck.mockImplementation(() => {
      throw createError({ statusCode: 403 })
    })
    await expect((await handler())({} as never)).rejects.toMatchObject({ statusCode: 403 })
    expect(enhanced).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })

  it('rate limits repeated revocations before deleting sessions', async () => {
    rateLimit.mockResolvedValue(false)
    await expect((await handler())({} as never)).rejects.toMatchObject({ statusCode: 429 })
    expect(remove).not.toHaveBeenCalled()
  })

  it('succeeds when no other sessions remain', async () => {
    remove.mockResolvedValue({ count: 0 })
    await expect((await handler())({} as never)).resolves.toEqual({ success: true, count: 0 })
  })

  it('does not audit a deletion that failed', async () => {
    remove.mockRejectedValue(new Error('synthetic storage failure'))
    await expect((await handler())({} as never)).rejects.toThrow('synthetic storage failure')
    expect(audit).not.toHaveBeenCalled()
  })

  it('reports audit failures without turning a completed revocation into a failure', async () => {
    const error = new Error('synthetic audit failure')
    audit.mockRejectedValue(error)
    await expect((await handler())({} as never)).resolves.toEqual({ success: true, count: 3 })
    expect(report).toHaveBeenCalledWith('Session revocation audit failed', error, { userId: actor.id })
  })
})

describe('DELETE /api/sessions/:sessionId', () => {
  const handler = async () => (await import('../../../server/api/sessions/[sessionId].delete')).default

  it('restricts individual revocation to the authenticated account', async () => {
    await expect((await handler())({} as never)).resolves.toEqual({ success: true })
    expect(remove).toHaveBeenCalledWith({ where: { userId: actor.id, id: 'other-session' } })
    expect(originCheck).toHaveBeenCalledOnce()
    expect(rateLimit).toHaveBeenCalledWith('session-revoke:account-1', 20, 60)
  })

  it('returns not found for a missing or foreign session', async () => {
    remove.mockResolvedValue({ count: 0 })
    await expect((await handler())({} as never)).rejects.toMatchObject({ statusCode: 404 })
    expect(audit).not.toHaveBeenCalled()
  })

  it('reports audit failures after an individual revocation', async () => {
    const error = new Error('synthetic audit failure')
    audit.mockRejectedValue(error)
    await expect((await handler())({} as never)).resolves.toEqual({ success: true })
    expect(report).toHaveBeenCalledWith('Session revocation audit failed', error, { userId: actor.id })
  })
})

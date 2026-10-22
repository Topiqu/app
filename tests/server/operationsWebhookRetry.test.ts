import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const id = '11111111-1111-4111-8111-111111111111'
const row = { id, clientSiteId: 'tenant-fixture', attempts: 6 }
const findFirst = vi.fn()
const updateMany = vi.fn()
const auth = vi.fn()
const origin = vi.fn()
const audit = vi.fn()
const rateLimit = vi.fn()
const transaction = vi.fn()
const tx = { webhookDelivery: { updateMany } }
let params: { id: string }
let body: unknown

beforeEach(() => {
  vi.clearAllMocks()
  params = { id }
  body = { confirmDuplicateRisk: true }
  findFirst.mockResolvedValue(row)
  updateMany.mockResolvedValue({ count: 1 })
  auth.mockResolvedValue({ user: { id: 'superadmin' }, db: { webhookDelivery: { findFirst } } })
  origin.mockImplementation(() => {})
  audit.mockResolvedValue(undefined)
  rateLimit.mockResolvedValue(true)
  transaction.mockImplementation((run: (client: typeof tx) => unknown) => run(tx))
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('requireDb', auth)
  vi.stubGlobal('requireSameAuthOrigin', origin)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getValidatedRouterParams', async (_event: unknown, parse: (value: unknown) => unknown) =>
    parse(params),
  )
  vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (value: unknown) => unknown) => parse(body))
  vi.stubGlobal('consumeRateLimit', rateLimit)
  vi.stubGlobal('createError', (error: object) => error)
  vi.stubGlobal('logAction', audit)
  vi.stubGlobal('getIp', () => '127.0.0.1')
  vi.stubGlobal('setResponseHeader', vi.fn())
  vi.stubGlobal('prisma', { $transaction: transaction })
})
afterEach(() => vi.unstubAllGlobals())
const run = async () => {
  const handler = (await import('../../server/api/admin/webhook-deliveries/[id]/retry.post')).default
  return handler({} as never)
}

describe('superadmin queue-only webhook retry', () => {
  it('requeues only the same failed event and audits the previous attempt count in the transaction', async () => {
    await expect(run()).resolves.toEqual({ queued: true })
    expect(auth).toHaveBeenCalledWith(expect.anything(), { role: 'superadmin' })
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id,
        clientSiteId: row.clientSiteId,
        deletedAt: null,
        status: 'FAILED',
        attempts: 6,
        webhook: { active: true, deletedAt: null },
        clientSite: { deletedAt: null, plan: { not: 'BASIC' } },
      },
      data: { status: 'PENDING', nextAttemptAt: expect.any(Date) },
    })
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'WEBHOOK_DELIVERY_RETRY_QUEUED',
        clientSiteId: row.clientSiteId,
        metadata: { deliveryId: id, previousAttempts: 6 },
        tx,
      }),
    )
    expect(JSON.stringify(updateMany.mock.calls)).not.toMatch(/payload|secret|webhookId/)
  })
  it('blocks unauthorized or cross-origin requests before reading a delivery', async () => {
    auth.mockRejectedValueOnce({ statusCode: 403 })
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(findFirst).not.toHaveBeenCalled()
    origin.mockImplementation(() => {
      throw { statusCode: 403 }
    })
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(transaction).not.toHaveBeenCalled()
  })
  it('requires explicit acknowledgement of duplicate delivery risk and valid IDs', async () => {
    body = { confirmDuplicateRisk: false }
    await expect(run()).rejects.toThrow()
    body = { confirmDuplicateRisk: true }
    params = { id: '../unsafe' }
    await expect(run()).rejects.toThrow()
    expect(findFirst).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })
  it('rejects exhausted manual rate limits without a write', async () => {
    rateLimit.mockResolvedValue(false)
    await expect(run()).rejects.toMatchObject({ statusCode: 429 })
    expect(findFirst).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })
  it('rejects an already running/succeeded delivery or an endpoint disabled concurrently', async () => {
    findFirst.mockResolvedValueOnce(null)
    await expect(run()).rejects.toMatchObject({ statusCode: 409 })
    updateMany.mockResolvedValue({ count: 0 })
    await expect(run()).rejects.toMatchObject({ statusCode: 409 })
    expect(audit).not.toHaveBeenCalled()
  })
  it('does not report a successful retry when the audit transaction fails', async () => {
    audit.mockRejectedValue(new Error('audit failed'))
    await expect(run()).rejects.toThrow('audit failed')
  })
})

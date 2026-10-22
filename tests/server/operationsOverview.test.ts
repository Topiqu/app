import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.fn()
const header = vi.fn()
const count = () => vi.fn().mockResolvedValue(0)
const db = {
  systemTaskStatus: { findMany: vi.fn() },
  clientSite: { count: count() },
  articleTranslation: { count: count() },
  webhookDelivery: { count: count(), findMany: vi.fn() },
  domainConnection: { count: count(), findMany: vi.fn() },
}
const receiptCount = count()

beforeEach(() => {
  vi.clearAllMocks()
  auth.mockResolvedValue({ db, user: { id: 'superadmin' } })
  db.systemTaskStatus.findMany.mockResolvedValue([
    {
      name: 'translate-pending',
      status: 'failed',
      startedAt: new Date('2026-10-21T10:00:00Z'),
      finishedAt: null,
      lastSucceededAt: new Date('2026-10-20T10:00:00Z'),
      lastFailedAt: new Date('2026-10-21T10:00:00Z'),
      failureCode: 'private-provider-error',
      durationMs: 500,
      processed: 0,
      failed: 1,
      skipped: null,
    },
  ])
  db.webhookDelivery.findMany.mockResolvedValue([
    {
      id: 'delivery',
      event: 'ARTICLE_PUBLISHED',
      status: 'FAILED',
      attempts: 6,
      nextAttemptAt: new Date('2026-10-21T10:00:00Z'),
      lastStatusCode: 503,
      payload: { private: 'private-payload' },
      lastError: 'private-error',
      clientSite: { name: 'Example site', plan: 'PRO' },
      webhook: { active: true, deletedAt: null, secret: 'private-secret' },
    },
  ])
  db.domainConnection.findMany.mockResolvedValue([
    {
      id: 'domain',
      host: 'blog.example.invalid',
      state: 'ROUTING',
      checkedAt: null,
      errorCode: 'private-error',
      certificateExpiresAt: null,
      clientSite: { name: 'Example site' },
      challenge: 'private-challenge',
    },
  ])
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('requireDb', auth)
  vi.stubGlobal('setResponseHeader', header)
  vi.stubGlobal('cacheAvailability', async () => 'ready')
  vi.stubGlobal('activeFeatureFilter', () => ({ features: { some: { isActive: true } } }))
  vi.stubGlobal('GENERATION_LEAD_MS', 3 * 60 * 60 * 1000)
  vi.stubGlobal('prisma', { articleGenerationSession: { count: receiptCount } })
})
afterEach(() => vi.unstubAllGlobals())
const run = async () => {
  const handler = (await import('../../server/api/admin/operations.get')).default
  return handler({} as never)
}

describe('superadmin operations overview', () => {
  it('requires superadmin access before reading system-wide data', async () => {
    auth.mockRejectedValue({ statusCode: 403 })
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(auth).toHaveBeenCalledWith(expect.anything(), { role: 'superadmin' })
    expect(receiptCount).not.toHaveBeenCalled()
    expect(db.webhookDelivery.findMany).not.toHaveBeenCalled()
  })
  it('returns only safe summaries, caps issue lists and prevents response caching', async () => {
    const overview = await run()
    expect(header).toHaveBeenCalledWith(expect.anything(), 'Cache-Control', 'private, no-store')
    expect(db.webhookDelivery.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }))
    expect(db.domainConnection.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }))
    expect(overview).toMatchObject({
      cache: 'ready',
      webhooks: { items: [{ reason: 'endpointUnavailable', canRetry: true }] },
      domains: { items: [{ reason: 'domainRouting' }] },
    })
    expect(JSON.stringify(overview)).not.toContain('private-')
    expect(overview.tasks.find((task) => task.name === 'translate-pending')).toMatchObject({
      status: 'failed',
      failureCode: 'TASK_FAILED',
      overdue: true,
    })
    expect(overview.tasks.find((task) => task.name === 'generate-article')).toMatchObject({
      status: 'unknown',
      lastSucceededAt: null,
      overdue: false,
    })
    expect(receiptCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null, clientSite: { deletedAt: null } }) }),
    )
  })
  it('does not offer retry when an endpoint is disabled or its tenant plan is ineligible', async () => {
    const [delivery] = await db.webhookDelivery.findMany()
    db.webhookDelivery.findMany.mockResolvedValue([{ ...delivery, webhook: { active: false, deletedAt: null } }])
    expect((await run()).webhooks.items[0]).toMatchObject({ canRetry: false, reason: 'endpointDisabled' })
    db.webhookDelivery.findMany.mockResolvedValue([
      { ...delivery, clientSite: { name: 'Example site', plan: 'BASIC' } },
    ])
    expect((await run()).webhooks.items[0]?.canRetry).toBe(false)
  })
})

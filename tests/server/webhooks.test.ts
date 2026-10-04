import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { webhookEventType, webhookUrlError } from '../../shared/utils/webhooks'

const postPublicUrl = vi.fn()
vi.mock('../../server/utils/images/publicFetch', () => ({ postPublicUrl }))

const { deliverDueWebhooks, enqueueArticleWebhook, signWebhook, webhookRetryAt, WEBHOOK_DISABLE_AFTER } = await import(
  '../../server/utils/webhooks'
)

const db = {
  webhook: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  webhookDelivery: {
    updateMany: vi.fn(),
    findMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    createMany: vi.fn(),
  },
  article: { findFirst: vi.fn() },
}

beforeEach(() => {
  vi.stubGlobal('prisma', db)
  vi.stubGlobal('externalArticleSelect', { id: true })
  vi.stubGlobal('flattenExternalArticle', (article: object, language: string) => ({ ...article, language }))
  db.webhookDelivery.updateMany.mockResolvedValue({ count: 1 })
  db.webhookDelivery.findMany.mockResolvedValue([{ id: 'd1' }])
  db.webhookDelivery.findUniqueOrThrow.mockResolvedValue({
    attempts: 1,
    payload: { type: 'article.published' },
    webhookId: 'w1',
  })
  db.webhook.findUnique.mockResolvedValue({ url: 'https://hooks.example.org/a', secret: 'whsec_x', active: true })
  db.webhook.updateMany.mockResolvedValue({ count: 0 })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const respond = (status: number) => postPublicUrl.mockResolvedValue(new Response(null, { status }))
const deliveryUpdate = () => db.webhookDelivery.update.mock.calls.at(-1)![0].data

describe('webhook wire format', () => {
  it('signs the timestamp together with the body', () => {
    const expected = createHmac('sha256', 'whsec_x').update('1700000000.{"a":1}').digest('hex')
    expect(signWebhook('whsec_x', 1700000000, '{"a":1}')).toBe(`t=1700000000,v1=${expected}`)
  })

  it('names events the way receivers switch on them', () => {
    expect(webhookEventType('ARTICLE_PUBLISHED')).toBe('article.published')
    expect(webhookEventType('ARTICLE_UNPUBLISHED')).toBe('article.unpublished')
  })

  it('accepts only public-looking HTTPS endpoints', () => {
    expect(webhookUrlError('https://hooks.zapier.com/hooks/catch/1/abc')).toBeNull()
    expect(webhookUrlError('http://hooks.zapier.com/x')).toBe('https')
    expect(webhookUrlError('https://user:pass@example.org/x')).toBe('invalid')
    expect(webhookUrlError('https://example.org:8443/x')).toBe('invalid')
    expect(webhookUrlError('https://169.254.169.254/latest')).toBe('host')
    expect(webhookUrlError('https://[::1]/x')).toBe('host')
    expect(webhookUrlError('https://localhost/x')).toBe('host')
    expect(webhookUrlError('https://service.internal/x')).toBe('host')
    expect(webhookUrlError('not a url')).toBe('invalid')
  })
})

describe('webhookRetryAt', () => {
  it('backs off and gives up after the last retry', () => {
    const now = new Date('2026-10-04T10:00:00Z')
    expect(webhookRetryAt(1, now)).toEqual(new Date('2026-10-04T10:01:00Z'))
    expect(webhookRetryAt(5, now)).toEqual(new Date('2026-10-04T22:00:00Z'))
    expect(webhookRetryAt(6, now)).toBeNull()
  })
})

describe('deliverDueWebhooks', () => {
  it('marks a 2xx delivery succeeded and clears the failure streak', async () => {
    respond(204)
    await expect(deliverDueWebhooks()).resolves.toMatchObject({ due: 1, delivered: 1, failed: 0 })

    const [url, body, headers] = postPublicUrl.mock.calls[0]!
    expect(url).toBe('https://hooks.example.org/a')
    expect(body).toBe('{"type":"article.published"}')
    expect(headers).toMatchObject({ 'Topiqu-Delivery': 'd1', 'Topiqu-Event': 'article.published' })
    expect(headers['Topiqu-Signature']).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/)
    expect(deliveryUpdate()).toMatchObject({ status: 'SUCCEEDED', lastStatusCode: 204, lastError: null })
    expect(db.webhook.update.mock.calls[0]![0].data.failureStreak).toBe(0)
  })

  it('schedules a retry for a failed attempt that has retries left', async () => {
    respond(500)
    await deliverDueWebhooks()
    expect(deliveryUpdate()).toMatchObject({ status: 'PENDING', lastStatusCode: 500, lastError: 'HTTP 500' })
    expect(db.webhook.update.mock.calls[0]![0].data.failureStreak).toEqual({ increment: 1 })
    expect(db.webhook.updateMany.mock.calls[0]![0].where.failureStreak).toEqual({ gte: WEBHOOK_DISABLE_AFTER })
  })

  it('fails a delivery for good after the last retry and records transport errors', async () => {
    db.webhookDelivery.findUniqueOrThrow.mockResolvedValue({ attempts: 6, payload: { type: 'ping' }, webhookId: 'w1' })
    postPublicUrl.mockRejectedValue(new Error('host resolved to a non-public address'))
    await deliverDueWebhooks()
    expect(deliveryUpdate()).toMatchObject({ status: 'FAILED', lastStatusCode: null })
    expect(deliveryUpdate().lastError).toContain('non-public')
  })

  it('skips a delivery another worker already claimed', async () => {
    db.webhookDelivery.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 0 })
    await expect(deliverDueWebhooks()).resolves.toMatchObject({ delivered: 0, failed: 0 })
    expect(postPublicUrl).not.toHaveBeenCalled()
  })

  it('does not send to a paused endpoint', async () => {
    db.webhook.findUnique.mockResolvedValue({ url: 'https://hooks.example.org/a', secret: 's', active: false })
    await deliverDueWebhooks()
    expect(postPublicUrl).not.toHaveBeenCalled()
    expect(deliveryUpdate()).toMatchObject({ status: 'FAILED', lastError: 'Endpoint disabled' })
  })
})

describe('enqueueArticleWebhook', () => {
  it('writes nothing when no active endpoint subscribes to the event', async () => {
    db.webhook.findMany.mockResolvedValue([])
    await enqueueArticleWebhook('ARTICLE_PUBLISHED', { id: 'a1', clientSiteId: 's1' })
    expect(db.webhook.findMany.mock.calls[0]![0].where).toMatchObject({
      clientSiteId: 's1',
      active: true,
      events: { has: 'ARTICLE_PUBLISHED' },
      clientSite: { plan: { not: 'BASIC' } },
    })
    expect(db.webhookDelivery.createMany).not.toHaveBeenCalled()
  })

  it('sends the public URL of a published article', async () => {
    db.webhook.findMany.mockResolvedValue([{ id: 'w1' }])
    db.webhookDelivery.findMany.mockResolvedValue([])
    db.article.findFirst.mockResolvedValue({
      id: 'a1',
      slug: 'prvni',
      clientSite: { domain: 'blog.example.cz', language: 'cs' },
    })
    await enqueueArticleWebhook('ARTICLE_PUBLISHED', { id: 'a1', clientSiteId: 's1' })
    const row = db.webhookDelivery.createMany.mock.calls[0]![0].data[0]
    expect(row).toMatchObject({ webhookId: 'w1', clientSiteId: 's1', event: 'ARTICLE_PUBLISHED' })
    expect(row.payload).toMatchObject({
      type: 'article.published',
      data: { article: { id: 'a1', url: 'https://blog.example.cz/cs/clanky/prvni' } },
    })
  })

  it('describes a deleted article from the snapshot, since the row is gone', async () => {
    db.webhook.findMany.mockResolvedValue([{ id: 'w1' }])
    db.webhookDelivery.findMany.mockResolvedValue([])
    await enqueueArticleWebhook('ARTICLE_DELETED', { id: 'a1', clientSiteId: 's1', slug: 'prvni', language: 'cs' })
    expect(db.article.findFirst).not.toHaveBeenCalled()
    expect(db.webhookDelivery.createMany.mock.calls[0]![0].data[0].payload.data).toEqual({
      article: { id: 'a1', slug: 'prvni', language: 'cs' },
    })
  })

  it('never fails the article write that triggered it', async () => {
    db.webhook.findMany.mockRejectedValue(new Error('db down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(enqueueArticleWebhook('ARTICLE_UPDATED', { id: 'a1', clientSiteId: 's1' })).resolves.toBeUndefined()
  })
})

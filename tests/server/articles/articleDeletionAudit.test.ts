import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => vi.resetModules())
afterEach(() => vi.unstubAllGlobals())

const setup = async () => {
  const log = vi.fn().mockResolvedValue({})
  const remove = vi
    .fn()
    .mockResolvedValue({ id: 'article-1', clientSiteId: 'tenant-1', title: 'Article title', status: 'published' })
  const invalidate = vi.fn()
  const webhook = vi.fn()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('requireTenantScope', async () => ({
    user: { id: 'author-1', clientSiteId: 'tenant-1' },
    membership: {},
  }))
  vi.stubGlobal('getEnhancedPrisma', async () => ({
    article: { findUnique: async () => ({ userId: 'author-1' }), delete: remove },
  }))
  vi.stubGlobal('getIp', () => '203.0.113.4')
  vi.stubGlobal('articlePublicPaths', async () => ['/cs/clanky/article'])
  vi.stubGlobal('logAction', log)
  vi.stubGlobal('reportCaughtError', vi.fn().mockRejectedValue(new Error('Reporter unavailable')))
  vi.stubGlobal('invalidateFeed', invalidate)
  vi.stubGlobal('enqueueArticleWebhook', webhook)
  vi.stubGlobal('announceArticle', vi.fn())
  const handler = (await import('../../../server/api/articles/[id]/index.delete')).default
  return { run: () => handler({ context: { params: { id: 'article-1' } } } as never), log, remove, invalidate, webhook }
}

describe('article deletion audit', () => {
  it('records the deleted article and actor without storing the body', async () => {
    const { run, log } = await setup()
    await expect(run()).resolves.toEqual({ success: true })
    expect(log).toHaveBeenCalledWith({
      action: 'ARTICLE_DELETED',
      userId: 'author-1',
      clientSiteId: 'tenant-1',
      ip: '203.0.113.4',
      metadata: { articleId: 'article-1', title: 'Article title', status: 'published' },
    })
  })

  it('does not report a deletion when the database write fails', async () => {
    const { run, log, remove } = await setup()
    remove.mockRejectedValue(new Error('Deletion failed'))
    await expect(run()).rejects.toThrow('Deletion failed')
    expect(log).not.toHaveBeenCalled()
  })

  it('still invalidates published content and sends its webhook when telemetry is unavailable', async () => {
    const { run, log, invalidate, webhook } = await setup()
    log.mockRejectedValue(new Error('Audit unavailable'))
    await expect(run()).resolves.toEqual({ success: true })
    expect(invalidate).toHaveBeenCalledWith('tenant-1')
    expect(webhook).toHaveBeenCalledWith('ARTICLE_DELETED', expect.objectContaining({ id: 'article-1' }))
  })
})

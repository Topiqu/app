// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('background work recovery', () => {
  it('recovers expired translation claims without allowing an old worker to overwrite a newer result', async () => {
    vi.stubGlobal('defineMonitoredTask', (task: unknown) => task)
    vi.stubGlobal('activeFeatureFilter', () => ({}))
    const claimedAt = new Date()
    const updateMany = vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 1 })
    const finalUpdate = vi.fn().mockResolvedValue({ count: 0 })
    const media = vi.fn()
    const invalidate = vi.fn()
    vi.stubGlobal('syncArticleMediaUsages', media)
    vi.stubGlobal('invalidateFeed', invalidate)
    vi.stubGlobal('prisma', {
      articleTranslation: {
        updateMany,
        findMany: async () => [{ id: 'translation' }],
        findUnique: async () => ({
          id: 'translation',
          language: 'en',
          clientSiteId: 'site',
          article: { id: 'article', title: 'Source' },
          clientSite: { translationMode: 'AUTO', publishToWeb: true },
        }),
      },
      $transaction: (run: (tx: unknown) => unknown) => run({ articleTranslation: { updateMany: finalUpdate } }),
    })
    vi.stubGlobal('generateTranslation', async () => ({
      slug: 'translated',
      title: 'Translated',
      content: '<p>Content</p>',
      usage: { totalTokens: 10 },
    }))
    vi.stubGlobal('recordAiUsage', vi.fn())
    vi.stubGlobal('dedupeTranslationSlug', async () => 'translated')
    vi.stubGlobal('sanitizeHtml', (html: string) => html)
    vi.stubGlobal('aiModelId', () => 'test-model')
    vi.stubGlobal('toDatabaseJson', (value: unknown) => value)
    const audit = vi.fn()
    vi.stubGlobal('logAction', audit)
    const { default: task } = await import('../../server/tasks/translate-pending')
    await task.run({} as never)
    const recovery = updateMany.mock.calls[0]![0]
    expect(recovery.where.status).toBe('TRANSLATING')
    expect(recovery.where.updatedAt.lt.getTime()).toBeLessThanOrEqual(claimedAt.getTime() - 29 * 60_000)
    expect(recovery.data.status).toBe('PENDING')
    const claim = updateMany.mock.calls[1]![0]
    expect(finalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'translation', status: 'TRANSLATING', updatedAt: claim.data.updatedAt }),
      }),
    )
    expect(media).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
    expect(audit).not.toHaveBeenCalled()
  })

  it('does not hold a request open while the external log transport is stalled', async () => {
    vi.stubEnv('BETTERSTACK_SOURCE_TOKEN', 'synthetic-test-token')
    vi.stubEnv('BETTERSTACK_INGEST_HOST', 'logs.example.invalid')
    vi.spyOn(console, 'info').mockImplementation(() => {})
    let release!: () => void
    const stalled = new Promise<void>((resolve) => {
      release = resolve
    })
    const fetch = vi.fn().mockReturnValue(stalled)
    vi.stubGlobal('$fetch', fetch)
    const { logger } = await import('../../server/utils/logger')
    await logger.info('synthetic event')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0]![1]).toMatchObject({ timeout: 5000, retry: 0 })
    release()
    await stalled
  })
})

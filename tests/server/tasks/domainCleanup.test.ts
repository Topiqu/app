import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllGlobals())

describe('minute domain cleanup', () => {
  it('retries durable markers even after an old provisioner wrote READY, and reports provider failures', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 'a', clientSiteId: 'blog' },
      { id: 'b', clientSiteId: 'blog' },
    ])
    const cleanup = vi.fn().mockResolvedValueOnce({ state: 'DISCONNECTED' }).mockResolvedValueOnce({ state: 'ERROR' })
    vi.stubGlobal('defineMonitoredTask', (task: unknown) => task)
    vi.stubGlobal('prisma', { domainConnection: { findMany } })
    vi.stubGlobal('attemptDomainCleanup', cleanup)
    const task = (await import('../../../server/tasks/domain-cleanup')).default
    expect(await task.run({} as never)).toEqual({ result: { attempted: 2, processed: 1, failed: 1 } })
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cleanupRequestedAt: { not: null }, state: { not: 'DISCONNECTED' } },
        take: 10,
      }),
    )
    expect(cleanup).toHaveBeenCalledWith('a', 'blog')
  })
})

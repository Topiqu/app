import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearOfAutopilot } from '../../shared/utils/articleBatch'

vi.mock('../../server/tasks/generate-article', () => ({
  loadGenerationClient: vi.fn(),
  processClient: vi.fn(),
}))
vi.stubGlobal('defineMonitoredTask', (definition: unknown) => definition)

const { loadGenerationClient, processClient } = await import('../../server/tasks/generate-article')
const task = await import('../../server/tasks/article-batches')

const now = new Date('2026-11-10T09:00:00.000Z')

const item = (overrides: Record<string, unknown> = {}) => ({
  id: 'item-1',
  batchId: 'batch-1',
  clientSiteId: 'site-1',
  topic: 'Pond care in winter',
  instructions: null,
  keywordClusterId: 'cluster-1',
  clusterPinned: true,
  scheduledFor: new Date('2026-11-10T10:00:00.000Z'),
  attempts: 1,
  batch: { mode: 'DRAFTS' as const, requestedById: 'user-1', pauseReason: null },
  ...overrides,
})

describe('article-batches task', () => {
  let itemUpdateMany: ReturnType<typeof vi.fn>
  let itemFindMany: ReturnType<typeof vi.fn>
  let batchUpdateMany: ReturnType<typeof vi.fn>
  let batchCount: ReturnType<typeof vi.fn>
  let clusterCount: ReturnType<typeof vi.fn>
  let clusterUpdateMany: ReturnType<typeof vi.fn>
  let locked: ReturnType<typeof vi.fn>
  let release: ReturnType<typeof vi.fn>
  let finishIfDone: ReturnType<typeof vi.fn>
  let notifyPaused: ReturnType<typeof vi.fn>
  let notifyEnded: ReturnType<typeof vi.fn>
  let access: ReturnType<typeof vi.fn>
  let cancel: ReturnType<typeof vi.fn>
  let wallet: ReturnType<typeof vi.fn>
  let replan: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.mocked(processClient).mockReset()
    itemUpdateMany = vi.fn().mockResolvedValue({ count: 1 })
    itemFindMany = vi.fn().mockResolvedValue([])
    batchUpdateMany = vi.fn().mockResolvedValue({ count: 1 })
    batchCount = vi.fn().mockResolvedValue(1)
    clusterCount = vi.fn().mockResolvedValue(1)
    clusterUpdateMany = vi.fn().mockResolvedValue({ count: 0 })
    locked = vi.fn().mockResolvedValue([{ locked: true }])
    release = vi.fn().mockResolvedValue(undefined)
    finishIfDone = vi.fn().mockResolvedValue(false)
    notifyPaused = vi.fn().mockResolvedValue(undefined)
    notifyEnded = vi.fn().mockResolvedValue(undefined)
    access = vi.fn().mockResolvedValue('ok')
    cancel = vi.fn().mockResolvedValue(undefined)
    wallet = vi.fn().mockResolvedValue({ available: 10 })
    replan = vi.fn().mockResolvedValue([])
    const client = {
      $queryRaw: locked,
      articleBatchItem: { updateMany: itemUpdateMany, findMany: itemFindMany },
      articleBatch: { updateMany: batchUpdateMany, count: batchCount },
      keywordCluster: { count: clusterCount, updateMany: clusterUpdateMany },
    }
    vi.stubGlobal('prisma', { ...client, $transaction: (run: (tx: typeof client) => unknown) => run(client) })
    vi.stubGlobal('releaseBatchCluster', release)
    vi.stubGlobal('finishArticleBatchIfDone', finishIfDone)
    vi.stubGlobal('notifyArticleBatchPaused', notifyPaused)
    vi.stubGlobal('notifyArticleBatchEnded', notifyEnded)
    vi.stubGlobal('articleBatchAccess', access)
    vi.stubGlobal('cancelArticleBatch', cancel)
    vi.stubGlobal('getArticleCreditWallet', wallet)
    vi.stubGlobal('replanArticleBatch', replan)
    vi.stubGlobal('articleCreditCost', () => 2)
    vi.stubGlobal('clearOfAutopilot', clearOfAutopilot)
    vi.stubGlobal('firstRankCheck', () => new Date('2026-12-01T00:00:00.000Z'))
    vi.stubGlobal('GENERATION_LEAD_MS', 3 * 60 * 60_000)
    vi.stubGlobal('reportCaughtError', vi.fn())
    vi.mocked(loadGenerationClient).mockResolvedValue({ id: 'site-1', articleQuality: 'HIGH' } as never)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('defineMonitoredTask', (definition: unknown) => definition)
  })

  describe('claiming', () => {
    const candidate = (id: string, clientSiteId: string, overrides = {}) => ({
      ...item({ id, clientSiteId, ...overrides }),
      scheduledFor: now,
    })

    it('starts one article per tenant so a large batch cannot crowd out the others', async () => {
      itemFindMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([candidate('a1', 'site-a'), candidate('a2', 'site-a'), candidate('b1', 'site-b')])
      const claimed = await task.claimBatchItems(now)
      expect(claimed.map(({ id }) => id)).toEqual(['a1', 'b1'])
      expect(itemUpdateMany).toHaveBeenCalledTimes(2)
      expect(itemUpdateMany).toHaveBeenCalledWith({
        where: { id: 'a1', status: 'QUEUED' },
        data: {
          status: 'RUNNING',
          startedAt: now,
          leaseUntil: new Date(now.getTime() + 5 * 60_000),
          attempts: { increment: 1 },
        },
      })
    })

    it('leaves the claim to another replica holding the lock', async () => {
      locked.mockResolvedValue([{ locked: false }])
      await expect(task.claimBatchItems(now)).resolves.toEqual([])
      expect(itemFindMany).not.toHaveBeenCalled()
    })

    it('skips a tenant that already has an article running', async () => {
      itemFindMany
        .mockResolvedValueOnce([{ clientSiteId: 'site-a' }])
        .mockResolvedValueOnce([candidate('a1', 'site-a'), candidate('b1', 'site-b')])
      expect((await task.claimBatchItems(now)).map(({ id }) => id)).toEqual(['b1'])
    })

    it('stays within the global capacity', async () => {
      itemFindMany.mockResolvedValueOnce([{ clientSiteId: 'x' }, { clientSiteId: 'y' }, { clientSiteId: 'z' }])
      await expect(task.claimBatchItems(now)).resolves.toEqual([])
      expect(itemFindMany).toHaveBeenCalledTimes(1)
    })

    it('only looks at active batches that are not paused, within the lead', async () => {
      await task.claimBatchItems(now)
      expect(itemFindMany.mock.calls[1]![0].where).toEqual({
        status: 'QUEUED',
        scheduledFor: { lte: new Date(now.getTime() + 3 * 60 * 60_000) },
        batch: {
          status: 'ACTIVE',
          deletedAt: null,
          OR: [{ pausedUntil: null }, { pausedUntil: { lte: now } }],
        },
      })
    })

    it('does not count a lost claim', async () => {
      itemFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([candidate('a1', 'site-a')])
      itemUpdateMany.mockResolvedValue({ count: 0 })
      await expect(task.claimBatchItems(now)).resolves.toEqual([])
    })

    it('moves an overdue spread plan forward instead of publishing the backlog at once', async () => {
      const overdue = {
        ...item({ batch: { mode: 'SPREAD', requestedById: 'user-1', pauseReason: 'credits' } }),
        scheduledFor: new Date(now.getTime() - 24 * 60 * 60_000),
      }
      itemFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([overdue])
      replan.mockResolvedValue([new Date(now.getTime() + 60_000)])
      const [claimed] = await task.claimBatchItems(now)
      expect(replan).toHaveBeenCalledWith('batch-1', now, expect.anything())
      expect(claimed!.scheduledFor).toEqual(new Date(now.getTime() + 60_000))
    })
  })

  describe('running', () => {
    it('writes the reserved topic under an attempt-scoped credit key', async () => {
      vi.mocked(processClient).mockResolvedValue({ status: 'draft', articleId: 'article-1' } as never)
      itemFindMany.mockResolvedValue([{ topic: 'Pond care in spring' }])
      await expect(task.runArticleBatchItem(item({ attempts: 3 }))).resolves.toMatchObject({ status: 'succeeded' })
      expect(processClient).toHaveBeenCalledWith(expect.anything(), expect.any(Date), {
        topic: 'Pond care in winter',
        instructions: null,
        batchItem: {
          id: 'item-1',
          attempts: 3,
          creditKey: 'article-batch:item-1:3',
          keywordClusterId: 'cluster-1',
          autoRelease: false,
          plannedTopics: ['Pond care in spring'],
          stillActive: expect.any(Function),
        },
      })
      expect(itemUpdateMany).toHaveBeenCalledWith({
        where: { id: 'item-1', status: 'RUNNING', attempts: 3 },
        data: expect.objectContaining({ status: 'SUCCEEDED', articleId: 'article-1' }),
      })
      expect(finishIfDone).toHaveBeenCalledWith('batch-1')
    })

    it('marks a topic its run could not load as used, so it does not stay reserved', async () => {
      vi.mocked(processClient).mockResolvedValue({ status: 'draft', articleId: 'article-1' } as never)
      await task.runArticleBatchItem(item())
      expect(clusterUpdateMany).toHaveBeenCalledWith({
        where: { id: 'cluster-1', status: 'RESERVED' },
        data: expect.objectContaining({ status: 'USED', articleId: 'article-1' }),
      })
    })

    it('tells the pipeline whether the plan is still wanted before it publishes', async () => {
      vi.mocked(processClient).mockResolvedValue({ status: 'draft', articleId: 'article-1' } as never)
      await task.runArticleBatchItem(item())
      const [, , request] = vi.mocked(processClient).mock.calls[0]!
      await expect(request!.batchItem!.stillActive()).resolves.toBe(true)
      batchCount.mockResolvedValue(0)
      await expect(request!.batchItem!.stillActive()).resolves.toBe(false)
    })

    it('releases a spread article at its slot, stepping past the autopilot', async () => {
      vi.mocked(processClient).mockResolvedValue({ status: 'draft', articleId: 'article-1' } as never)
      vi.mocked(loadGenerationClient).mockResolvedValue({
        id: 'site-1',
        nextReleaseAt: new Date('2026-11-10T10:30:00.000Z'),
      } as never)
      await task.runArticleBatchItem(item({ batch: { mode: 'SPREAD', requestedById: 'user-1', pauseReason: null } }))
      const [, slot, request] = vi.mocked(processClient).mock.calls[0]!
      expect(slot).toEqual(new Date('2026-11-10T12:30:00.000Z'))
      expect(request!.batchItem!.autoRelease).toBe(true)
    })

    it('skips a topic an in-flight autopilot run took, without charging anything', async () => {
      clusterCount.mockResolvedValue(0)
      await expect(task.runArticleBatchItem(item())).resolves.toMatchObject({ status: 'cancelled' })
      expect(processClient).not.toHaveBeenCalled()
      expect(itemUpdateMany).toHaveBeenCalledWith({
        where: { id: 'item-1', status: 'RUNNING', attempts: 1 },
        data: expect.objectContaining({ status: 'CANCELLED' }),
      })
    })

    it('pauses before any provider call when access is gone, and keeps the article queued', async () => {
      access.mockResolvedValue('member')
      await expect(task.runArticleBatchItem(item())).resolves.toMatchObject({ status: 'paused', reason: 'access' })
      expect(processClient).not.toHaveBeenCalled()
      expect(itemUpdateMany).toHaveBeenCalledWith({
        where: { id: 'item-1', status: 'RUNNING', attempts: 1 },
        data: { status: 'QUEUED', startedAt: null, leaseUntil: null },
      })
      expect(batchUpdateMany).toHaveBeenCalledWith({
        where: { id: 'batch-1', status: 'ACTIVE' },
        data: { pausedUntil: expect.any(Date), pauseReason: 'access' },
      })
      expect(notifyPaused).toHaveBeenCalledWith('batch-1', 'access')
      expect(release).not.toHaveBeenCalled()
    })

    it('never pauses the replacement batch when a superseded attempt loses access', async () => {
      access.mockResolvedValue('member')
      itemUpdateMany.mockResolvedValueOnce({ count: 0 })
      await expect(task.runArticleBatchItem(item())).resolves.toMatchObject({ status: 'superseded' })
      expect(batchUpdateMany).not.toHaveBeenCalled()
      expect(notifyPaused).not.toHaveBeenCalled()
    })

    it('ends the whole plan when the plan lapsed, so a later upgrade cannot resume publishing', async () => {
      access.mockResolvedValue('plan')
      await expect(task.runArticleBatchItem(item())).resolves.toMatchObject({ status: 'cancelled' })
      expect(cancel).toHaveBeenCalledWith('batch-1', 'site-1')
      expect(release).toHaveBeenCalled()
      expect(notifyEnded).toHaveBeenCalledWith('batch-1')
      expect(processClient).not.toHaveBeenCalled()
    })

    it('waits for credits instead of failing the article', async () => {
      wallet.mockResolvedValue({ available: 1 })
      await expect(task.runArticleBatchItem(item())).resolves.toMatchObject({ status: 'paused', reason: 'credits' })
      expect(processClient).not.toHaveBeenCalled()
    })

    it('notifies once per pause, not on every retry', async () => {
      wallet.mockResolvedValue({ available: 1 })
      await task.runArticleBatchItem(
        item({ batch: { mode: 'DRAFTS', requestedById: 'user-1', pauseReason: 'credits' } }),
      )
      expect(notifyPaused).not.toHaveBeenCalled()
    })

    it('waits when the pipeline runs into the cost guard', async () => {
      vi.mocked(processClient).mockResolvedValue({
        status: 'failed',
        error: 'AI allowance exhausted',
        pauseReason: 'allowance',
      } as never)
      await expect(task.runArticleBatchItem(item())).resolves.toMatchObject({ status: 'paused', reason: 'allowance' })
      expect(release).not.toHaveBeenCalled()
    })

    it('does not strand an article or its topic when the plan was cancelled during the run', async () => {
      vi.mocked(processClient).mockResolvedValue({
        status: 'failed',
        error: 'AI allowance exhausted',
        pauseReason: 'allowance',
      } as never)
      batchUpdateMany.mockResolvedValue({ count: 0 })
      await expect(task.runArticleBatchItem(item())).resolves.toMatchObject({ status: 'cancelled' })
      expect(itemUpdateMany).toHaveBeenLastCalledWith({
        where: { id: 'item-1', status: 'QUEUED' },
        data: expect.objectContaining({ status: 'CANCELLED' }),
      })
      expect(release).toHaveBeenCalled()
      expect(notifyPaused).not.toHaveBeenCalled()
    })

    it('fails the article and frees its topic on an ordinary failure', async () => {
      vi.mocked(processClient).mockResolvedValue({
        status: 'failed',
        error: 'Writer failed',
        pauseReason: null,
      } as never)
      await expect(task.runArticleBatchItem(item())).resolves.toMatchObject({ status: 'failed' })
      expect(itemUpdateMany).toHaveBeenCalledWith({
        where: { id: 'item-1', status: 'RUNNING', attempts: 1 },
        data: expect.objectContaining({ status: 'FAILED', error: 'Writer failed' }),
      })
      expect(release).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ keywordClusterId: 'cluster-1' }),
      )
    })

    it('does not touch an attempt that already replaced this one', async () => {
      vi.mocked(processClient).mockResolvedValue({ status: 'draft', articleId: 'article-1' } as never)
      itemUpdateMany.mockResolvedValue({ count: 0 })
      await task.runArticleBatchItem(item())
      expect(finishIfDone).not.toHaveBeenCalled()
      expect(clusterUpdateMany).not.toHaveBeenCalled()
    })

    it('clears a pause once an article succeeds', async () => {
      vi.mocked(processClient).mockResolvedValue({ status: 'draft', articleId: 'article-1' } as never)
      await task.runArticleBatchItem(
        item({ batch: { mode: 'DRAFTS', requestedById: 'user-1', pauseReason: 'credits' } }),
      )
      expect(batchUpdateMany).toHaveBeenCalledWith({
        where: { id: 'batch-1', status: 'ACTIVE' },
        data: { pausedUntil: null, pauseReason: null },
      })
    })

    it('stops spending our AI bill after repeated failures', async () => {
      vi.mocked(processClient).mockResolvedValue({
        status: 'failed',
        error: 'Writer failed',
        pauseReason: null,
      } as never)
      itemFindMany.mockImplementation(async ({ where }: { where: { status: unknown } }) =>
        typeof where.status === 'object' ? [{ status: 'FAILED' }, { status: 'FAILED' }, { status: 'FAILED' }] : [],
      )
      await task.runArticleBatchItem(item())
      expect(batchUpdateMany).toHaveBeenCalledWith({
        where: { id: 'batch-1', status: 'ACTIVE' },
        data: { pausedUntil: expect.any(Date), pauseReason: 'failures' },
      })
    })
  })

  describe('recovering dead runs', () => {
    const lost = (overrides = {}) => ({
      ...item(overrides),
      articleId: null,
      batch: { mode: 'DRAFTS', requestedById: 'user-1', pauseReason: null, status: 'ACTIVE' },
    })

    it('finds runs by their lapsed lease, with a hard limit for a hung one', async () => {
      await task.recoverLostBatchItems(now)
      expect(itemFindMany.mock.calls[0]![0].where).toEqual({
        status: 'RUNNING',
        OR: [{ leaseUntil: { lt: now } }, { startedAt: { lt: new Date(now.getTime() - 45 * 60_000) } }],
      })
    })

    it('writes the article again when nothing was saved', async () => {
      itemFindMany.mockResolvedValue([lost()])
      await expect(task.recoverLostBatchItems(now)).resolves.toBe(1)
      expect(itemUpdateMany).toHaveBeenCalledWith({
        where: {
          id: 'item-1',
          status: 'RUNNING',
          attempts: 1,
          articleId: null,
          OR: [{ leaseUntil: { lt: now } }, { startedAt: { lt: new Date(now.getTime() - 45 * 60_000) } }],
        },
        data: { status: 'QUEUED', startedAt: null, leaseUntil: null },
      })
      expect(release).not.toHaveBeenCalled()
    })

    it('never writes it twice when the article was saved before the worker died', async () => {
      itemFindMany.mockResolvedValue([{ ...lost(), articleId: 'article-1' }])
      await task.recoverLostBatchItems(now)
      expect(itemUpdateMany).toHaveBeenCalledWith({
        where: { id: 'item-1', status: 'RUNNING', attempts: 1 },
        data: expect.objectContaining({ status: 'SUCCEEDED', articleId: 'article-1' }),
      })
    })

    it('gives up after three attempts and frees the topic', async () => {
      itemFindMany.mockResolvedValue([lost({ attempts: 3 })])
      await task.recoverLostBatchItems(now)
      expect(itemUpdateMany).toHaveBeenCalledWith({
        where: {
          id: 'item-1',
          status: 'RUNNING',
          attempts: 3,
          articleId: null,
          OR: [{ leaseUntil: { lt: now } }, { startedAt: { lt: new Date(now.getTime() - 45 * 60_000) } }],
        },
        data: expect.objectContaining({ status: 'FAILED' }),
      })
      expect(release).toHaveBeenCalled()
    })

    it('does not mark a saved final attempt failed from an obsolete recovery snapshot', async () => {
      itemFindMany.mockResolvedValue([lost({ attempts: 3 })])
      itemUpdateMany.mockResolvedValueOnce({ count: 0 })
      await task.recoverLostBatchItems(now)
      expect(release).not.toHaveBeenCalled()
      expect(finishIfDone).not.toHaveBeenCalled()
      expect(itemUpdateMany.mock.calls[0]![0].where).toMatchObject({ articleId: null })
    })

    it('does not requeue into a cancelled plan', async () => {
      itemFindMany.mockResolvedValue([
        { ...lost(), batch: { mode: 'DRAFTS', requestedById: 'user-1', pauseReason: null, status: 'CANCELLED' } },
      ])
      await task.recoverLostBatchItems(now)
      expect(itemUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
      )
    })
  })
})

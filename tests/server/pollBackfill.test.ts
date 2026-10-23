// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DatabaseClient } from '../../server/utils/database'

import { invalidateFeed } from '../../server/utils/cache'
import { backfillPolls } from '../../scripts/backfill-polls'

vi.mock('../../server/utils/cache', () => ({
  invalidateFeed: vi.fn(async () => 'invalidated'),
  closeCache: vi.fn(),
}))

afterEach(() => vi.restoreAllMocks())
beforeEach(() => {
  vi.mocked(invalidateFeed).mockReset().mockResolvedValue('invalidated')
})

describe('bounded poll maintenance', () => {
  it('stops at the row budget and can resume without reading all bodies or writing in dry-run', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const rows = Array.from({ length: 500 }, (_, index) => ({
      id: String(index).padStart(4, '0'),
      slug: `poll-${index}`,
      clientSiteId: 'site-1',
      content: '<div data-type="poll" data-question="Question" data-options="[]"></div>',
    }))
    let largestPage = 0
    const write = vi.fn()
    const db = {
      article: {
        findMany: vi.fn(async ({ where, take }: { where: { id?: { gt: string } }; take?: number }) => {
          const page = rows.filter((row) => !where.id || row.id > where.id.gt).slice(0, take)
          largestPage = Math.max(largestPage, page.length)
          return page
        }),
        update: write,
      },
    } as unknown as DatabaseClient
    const first = await backfillPolls(db, { limit: 5, batchSize: 2 })
    expect(first).toMatchObject({ scanned: 5, needed: 5, updated: 0, nextCursor: '0004' })
    expect(largestPage).toBeLessThanOrEqual(2)
    const second = await backfillPolls(db, { limit: 5, batchSize: 2, afterId: '0004' })
    expect(second).toMatchObject({ scanned: 5, needed: 5, updated: 0, nextCursor: '0009' })
    expect(write).not.toHaveBeenCalled()
    expect(invalidateFeed).not.toHaveBeenCalled()
  })

  it('refuses invalid budgets before any database access', async () => {
    const read = vi.fn()
    const db = { article: { findMany: read } } as unknown as DatabaseClient
    await expect(backfillPolls(db, { batchSize: 0 })).rejects.toThrow()
    await expect(backfillPolls(db, { limit: Infinity })).rejects.toThrow()
    expect(read).not.toHaveBeenCalled()
  })

  const applyFixture = (outcomes: ('updated' | 'conflict' | 'unchanged' | 'rollback')[]) => {
    const content = '<div data-type="poll" data-question="Question" data-options="[]"></div>'
    const events: string[] = []
    let next = 0
    const db = {
      article: {
        findMany: async () =>
          next > 0 ? [] : outcomes.map((_, index) => ({ id: `article-${index}`, clientSiteId: 'site-1', content })),
      },
      $transaction: async (run: (tx: unknown) => Promise<unknown>) => {
        const index = next++
        const outcome = outcomes[index]!
        const tx = {
          $queryRaw: async () => (outcome === 'conflict' ? [] : [{ id: `article-${index}` }]),
          poll: { create: async () => ({ id: 'poll-1' }), deleteMany: vi.fn() },
          pollOption: { create: async () => ({ id: 'option-1' }), deleteMany: vi.fn() },
          article: { update: async () => events.push(`write:${index}`) },
        }
        const result = await run(tx)
        if (outcome === 'rollback') throw new Error('Transaction rolled back')
        events.push(`commit:${index}`)
        return outcome === 'unchanged' ? 'unchanged' : result
      },
    } as unknown as DatabaseClient
    return { db, events }
  }

  it('invalidates each repaired tenant only after its database transaction commits', async () => {
    const { db, events } = applyFixture(['updated', 'conflict', 'unchanged'])
    vi.mocked(invalidateFeed).mockImplementation(async (siteId) => {
      events.push(`invalidate:${siteId}`)
      return 'invalidated'
    })
    const result = await backfillPolls(db, { apply: true })
    expect(events).toEqual(['write:0', 'commit:0', 'invalidate:site-1', 'commit:1', 'write:2', 'commit:2'])
    expect(invalidateFeed).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      updated: 1,
      conflicted: 1,
      cacheInvalidated: 1,
      cacheUnavailable: 0,
      cacheUnconfigured: 0,
    })
  })

  it('does not invalidate a rolled-back repair while retaining earlier committed invalidations', async () => {
    const { db, events } = applyFixture(['updated', 'rollback'])
    vi.mocked(invalidateFeed).mockImplementation(async (siteId) => {
      events.push(`invalidate:${siteId}`)
      return 'invalidated'
    })
    await expect(backfillPolls(db, { apply: true })).rejects.toThrow('Transaction rolled back')
    expect(events).toEqual(['write:0', 'commit:0', 'invalidate:site-1', 'write:1'])
    expect(invalidateFeed).toHaveBeenCalledTimes(1)
  })

  it.each(['unavailable', 'unconfigured'] as const)(
    'reports %s invalidation without hiding a committed update',
    async (outcome) => {
      const { db } = applyFixture(['updated'])
      vi.mocked(invalidateFeed).mockResolvedValue(outcome)
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const result = await backfillPolls(db, { apply: true })
      expect(result).toMatchObject({
        updated: 1,
        cacheInvalidated: 0,
        [outcome === 'unavailable' ? 'cacheUnavailable' : 'cacheUnconfigured']: 1,
      })
      expect(warn).toHaveBeenCalledWith('[poll-backfill] committed repair needs cache invalidation', {
        clientSiteId: 'site-1',
        cache: outcome,
      })
    },
  )

  it('retains committed update counts when cache invalidation unexpectedly rejects', async () => {
    const { db } = applyFixture(['updated'])
    vi.mocked(invalidateFeed).mockRejectedValue(new Error('Private connection details'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(backfillPolls(db, { apply: true })).resolves.toMatchObject({ updated: 1, cacheUnavailable: 1 })
    expect(JSON.stringify(warn.mock.calls)).not.toContain('Private connection details')
  })
})

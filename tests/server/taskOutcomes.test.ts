// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../server/utils/searchConsole/crypto'), 'decryptSearchConsoleToken')
  await stubNitroImports(import('../../server/utils/shopify/publication'), 'publishShopifyArticle')
}

const publish = vi.hoisted(() => vi.fn())
vi.mock('../../server/utils/shopify/publication', () => ({ publishShopifyArticle: publish }))
vi.mock('../../server/utils/searchConsole/crypto', () => ({ decryptSearchConsoleToken: () => 'fixture' }))

const connections = vi.fn()
const connectionUpdate = vi.fn()
const publicationUpdate = vi.fn()
const publications = vi.fn()
const query = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  connections.mockResolvedValue([])
  connectionUpdate.mockResolvedValue({})
  publicationUpdate.mockResolvedValue({ count: 0 })
  publications.mockResolvedValue([])
  query.mockResolvedValue([])
  vi.stubGlobal('defineMonitoredTask', (task: unknown) => task)
  vi.stubGlobal('activeFeatureFilter', () => ({}))
  vi.stubGlobal('refreshSearchConsoleAccess', async () => 'fixture')
  vi.stubGlobal('querySearchConsole', query)
  vi.stubGlobal('prisma', {
    searchConsoleConnection: { findMany: connections, update: connectionUpdate },
    shopifyPublication: { findMany: publications, updateMany: publicationUpdate },
    shopifyInstallation: { deleteMany: vi.fn(async () => ({ count: 0 })) },
  })
})
afterEach(() => vi.unstubAllGlobals())

const runGsc = async () => {
  const task = (await import('../../server/tasks/search-console-sync')).default as unknown as {
    run: () => Promise<unknown>
  }
  return task.run()
}
const runShopify = async () => {
  const task = (await import('../../server/tasks/shopify-publish')).default as unknown as {
    run: () => Promise<unknown>
  }
  return task.run()
}

describe('scheduled task outcome summaries', () => {
  it('reports every failed Search Console connection, including a completely failed run', async () => {
    connections.mockResolvedValue([
      { id: 'one', encryptedRefreshToken: 'fixture' },
      { id: 'two', encryptedRefreshToken: 'fixture' },
    ])
    query.mockRejectedValue(new Error('upstream unavailable'))
    await expect(runGsc()).resolves.toEqual({ result: { connections: 2, synced: 0, failed: 2 } })
    expect(connectionUpdate).toHaveBeenCalledTimes(2)
    expect(connectionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ERROR' }) }),
    )
  })

  it('distinguishes partial Search Console success from an empty healthy run', async () => {
    connections.mockResolvedValue([
      { id: 'one', encryptedRefreshToken: 'fixture' },
      { id: 'two', encryptedRefreshToken: 'fixture' },
    ])
    query.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('upstream unavailable'))
    await expect(runGsc()).resolves.toEqual({ result: { connections: 2, synced: 1, failed: 1 } })
    connections.mockResolvedValue([])
    await expect(runGsc()).resolves.toEqual({ result: { connections: 0, synced: 0, failed: 0 } })
  })

  it('counts confirmed Shopify writes, provider failures, uncertain saves, queued retries and claim skips separately', async () => {
    publications.mockResolvedValue(['one', 'two', 'three', 'four', 'five'].map((id) => ({ id })))
    publish
      .mockResolvedValueOnce('SYNCED')
      .mockResolvedValueOnce('FAILED')
      .mockResolvedValueOnce('UNCERTAIN')
      .mockResolvedValueOnce('QUEUED')
      .mockResolvedValueOnce('SKIPPED')
    await expect(runShopify()).resolves.toEqual({
      result: { count: 5, processed: 1, failed: 3, skipped: 1, uncertain: 1, retrying: 1 },
    })
    expect(publish.mock.calls.map(([id]) => id)).toEqual(['one', 'two', 'three', 'four', 'five'])
  })

  it('reports interrupted Shopify leases as uncertain even when no new item is due', async () => {
    publicationUpdate.mockResolvedValue({ count: 2 })
    await expect(runShopify()).resolves.toEqual({
      result: { count: 0, processed: 0, failed: 2, skipped: 0, uncertain: 2, retrying: 0 },
    })
    expect(publish).not.toHaveBeenCalled()
  })
})

beforeEach(stubImports)

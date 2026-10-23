// @vitest-environment node
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { deleteFromCdn } from '../../../server/utils/storage'
import { createDatabaseClient } from '../../../server/utils/database'
import { findMediaReferences, mediaLibraryAsset } from '../../../server/utils/mediaLibrary'

vi.mock('../../../server/utils/storage', () => ({ deleteFromCdn: vi.fn().mockResolvedValue(undefined) }))

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url) : null
const sites: string[] = []
const users: string[] = []
const fixture = async () => {
  const clientSiteId = randomUUID()
  sites.push(clientSiteId)
  await db!.clientSite.create({
    data: { id: clientSiteId, name: `media-gc-${clientSiteId}`, domain: `${clientSiteId}.test` },
  })
  const asset = await db!.mediaAsset.create({
    data: {
      clientSiteId,
      url: `https://cdn.example.test/uploads/${clientSiteId}/test.webp`,
      storageKey: `uploads/${clientSiteId}/test.webp`,
      archivedAt: new Date(Date.now() - 8 * 86_400_000),
      purgeAfter: new Date(Date.now() - 60_000),
    },
  })
  return { clientSiteId, asset }
}

describe.skipIf(!enabled)('conservative media collection on PostgreSQL', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.stubGlobal('prisma', db)
    vi.stubGlobal('defineTask', (task: unknown) => task)
    vi.stubGlobal(
      'defineMonitoredTask',
      vi.fn((task: unknown) => task),
    )
    vi.stubGlobal('findMediaReferences', findMediaReferences)
    vi.stubGlobal('mediaLibraryAsset', mediaLibraryAsset)
    vi.stubGlobal('storageKeyFromMediaUrl', () => null)
    vi.stubGlobal('reportCaughtError', vi.fn().mockResolvedValue(undefined))
  })
  afterEach(async () => {
    if (db) {
      await db.clientSite.deleteMany({ where: { id: { in: sites } } })
      await db.user.deleteMany({ where: { id: { in: users } } })
    }
    sites.length = 0
    users.length = 0
    vi.unstubAllGlobals()
  })
  afterAll(async () => db?.$disconnect())

  it('monitors and quarantines a due object while reference writers are not fully fenced', async () => {
    const { asset } = await fixture()
    const task = (await import('../../../server/tasks/media-gc')).default
    const result = await task.run({} as never)
    expect(defineMonitoredTask).toHaveBeenCalledOnce()
    expect(result).toMatchObject({ result: { scanned: 1, purged: 0, quarantined: 1, failed: 0 } })
    expect(deleteFromCdn).not.toHaveBeenCalled()
    expect(await db!.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } })).toMatchObject({ purgedAt: null })
  })

  it('does not physically delete an object restored after candidate selection', async () => {
    const { clientSiteId, asset } = await fixture()
    let resume!: (references: number) => void
    let notify!: () => void
    const checking = new Promise<void>((resolve) => {
      notify = resolve
    })
    const waiting = new Promise<number>((resolve) => {
      resume = resolve
    })
    vi.stubGlobal('findMediaReferences', () => {
      notify()
      return waiting
    })
    const task = (await import('../../../server/tasks/media-gc')).default
    const running = task.run({} as never)
    await checking
    vi.stubGlobal('requireTenantScope', async () => ({ user: { id: 'test-user', clientSiteId } }))
    vi.stubGlobal('getRouterParam', () => asset.id)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    const restore = (await import('../../../server/api/media/[id]/restore.post')).default
    await restore({} as never)
    resume(0)
    expect(await running).toMatchObject({ result: { quarantined: 0, skipped: 1 } })
    expect(deleteFromCdn).not.toHaveBeenCalled()
    expect(await db!.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } })).toMatchObject({
      archivedAt: null,
      purgeAfter: null,
      purgedAt: null,
    })
  })

  it('advances bounded quarantine reviews so more than one hundred due objects are visited', async () => {
    const { clientSiteId } = await fixture()
    await db!.mediaAsset.createMany({
      data: Array.from({ length: 100 }, (_, index) => ({
        clientSiteId,
        url: `https://cdn.example.test/uploads/${clientSiteId}/${index}.webp`,
        storageKey: `uploads/${clientSiteId}/${index}.webp`,
        archivedAt: new Date(Date.now() - 8 * 86_400_000),
        purgeAfter: new Date(Date.now() - 7 * 86_400_000),
        updatedAt: new Date(Date.now() - 8 * 86_400_000),
      })),
    })
    const reviewed = new Set<string>()
    vi.stubGlobal('findMediaReferences', async (_scope: string | null, asset: { id: string }) => {
      reviewed.add(asset.id)
      return 0
    })
    const task = (await import('../../../server/tasks/media-gc')).default
    expect(await task.run({} as never)).toMatchObject({ result: { scanned: 100, quarantined: 100, failed: 0 } })
    expect(await task.run({} as never)).toMatchObject({ result: { scanned: 100, quarantined: 100, failed: 0 } })
    expect(reviewed.size).toBe(101)
    expect(await db!.mediaAsset.count({ where: { clientSiteId, purgedAt: { not: null } } })).toBe(0)
    expect(deleteFromCdn).not.toHaveBeenCalled()
  })

  it('counts a reviewed request once when two task replicas overlap', async () => {
    await fixture()
    let reads = 0
    let resume!: () => void
    const bothRead = new Promise<void>((resolve) => {
      resume = resolve
    })
    vi.stubGlobal('findMediaReferences', async () => {
      if (++reads === 2) resume()
      await bothRead
      return 0
    })
    const task = (await import('../../../server/tasks/media-gc')).default
    const results = await Promise.all([task.run({} as never), task.run({} as never)])
    expect(results.reduce((sum, result) => sum + result.result.quarantined, 0)).toBe(1)
    expect(results.reduce((sum, result) => sum + result.result.skipped, 0)).toBe(2)
    expect(deleteFromCdn).not.toHaveBeenCalled()
  })

  it('finds a legacy cover URL in a different tenant and retains the shared object', async () => {
    const { clientSiteId, asset } = await fixture()
    const otherId = randomUUID()
    const userId = randomUUID()
    sites.push(otherId)
    users.push(userId)
    await db!.clientSite.create({ data: { id: otherId, name: `legacy-${otherId}`, domain: `${otherId}.test` } })
    await db!.user.create({ data: { id: userId, email: `${userId}@example.invalid`, username: `legacy-${userId}` } })
    await db!.article.create({
      data: {
        clientSiteId: otherId,
        userId,
        slug: randomUUID(),
        language: 'en',
        title: 'Legacy cover',
        content: 'Content without an image tag',
        imageUrl: asset.url,
        status: 'published',
      },
    })
    expect(await findMediaReferences(clientSiteId, asset)).toBe(0)
    expect(await findMediaReferences(null, asset)).toBeGreaterThan(0)
    const task = (await import('../../../server/tasks/media-gc')).default
    expect(await task.run({} as never)).toMatchObject({ result: { retained: 1, purged: 0, failed: 0 } })
    expect(deleteFromCdn).not.toHaveBeenCalled()
  })

  it('counts reference-check failures without deleting the object or failing unrelated candidates', async () => {
    await fixture()
    vi.stubGlobal('findMediaReferences', vi.fn().mockRejectedValue(new Error('Synthetic database failure')))
    const task = (await import('../../../server/tasks/media-gc')).default
    expect(await task.run({} as never)).toMatchObject({ result: { failed: 1, purged: 0 } })
    expect(reportCaughtError).toHaveBeenCalledOnce()
    expect(deleteFromCdn).not.toHaveBeenCalled()
  })

  it('preserves bytes when a new legacy HTML reference appears after the reference snapshot', async () => {
    const { clientSiteId, asset } = await fixture()
    const userId = randomUUID()
    users.push(userId)
    await db!.user.create({
      data: { id: userId, email: `${userId}@example.invalid`, username: `new-reference-${userId}` },
    })
    const article = await db!.article.create({
      data: {
        clientSiteId,
        userId,
        slug: randomUUID(),
        language: 'en',
        title: 'New reference',
        content: 'No image yet',
      },
    })
    let resume!: (references: number) => void
    let notify!: () => void
    const checking = new Promise<void>((resolve) => {
      notify = resolve
    })
    const waiting = new Promise<number>((resolve) => {
      resume = resolve
    })
    vi.stubGlobal('findMediaReferences', async () => {
      const snapshot = await findMediaReferences(null, asset)
      expect(snapshot).toBe(0)
      notify()
      return waiting
    })
    const task = (await import('../../../server/tasks/media-gc')).default
    const running = task.run({} as never)
    await checking
    await db!.article.update({ where: { id: article.id }, data: { content: `<p><img src="${asset.url}"></p>` } })
    resume(0)
    expect(await running).toMatchObject({ result: { quarantined: 1, purged: 0 } })
    expect(deleteFromCdn).not.toHaveBeenCalled()
    expect(await findMediaReferences(null, asset)).toBeGreaterThan(0)
  })
})

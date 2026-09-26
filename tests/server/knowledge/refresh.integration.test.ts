// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createDatabaseClient } from '../../../server/utils/database'
import { hashKnowledge } from '../../../server/utils/knowledge/sources'
import { extractKnowledgeUrl } from '../../../server/utils/knowledge/extract'
import { refreshKnowledgeSources } from '../../../server/utils/knowledge/refresh'

vi.mock('../../../server/utils/knowledge/extract', async (original) => ({
  ...(await original<typeof import('../../../server/utils/knowledge/extract')>()),
  extractKnowledgeUrl: vi.fn(),
}))

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url) : null
const now = new Date('2026-09-24T03:45:00Z')

const urlSource = async (fetchedAt: Date, content = 'Pricing page: Pro costs 49 USD per month.') => {
  const clientSiteId = randomUUID()
  await db!.clientSite.create({ data: { id: clientSiteId, name: `refresh-${clientSiteId}`, domain: `${clientSiteId}.test` } })
  return db!.knowledgeSource.create({
    data: {
      clientSiteId,
      kind: 'URL',
      title: 'Pricing',
      sourceUrl: `https://${clientSiteId}.example.org/pricing`,
      content,
      contentHash: hashKnowledge(content),
      status: 'INDEXED',
      embeddingModel: 'text-embedding-3-small',
      fetchedAt,
    },
  })
}

describe.skipIf(!enabled)('knowledge refresh on PostgreSQL', () => {
  beforeAll(() => {
    vi.stubGlobal('prisma', db)
    // Every test tenant counts as AI-enabled; the feature filter itself is covered elsewhere.
    vi.stubGlobal('activeFeatureFilter', () => ({}))
    vi.stubGlobal('logAction', vi.fn())
    vi.stubGlobal('reportCaughtError', vi.fn())
    vi.stubGlobal('indexKnowledgeSource', vi.fn())
  })
  afterAll(async () => {
    await db?.$disconnect()
    vi.unstubAllGlobals()
  })
  beforeEach(() => {
    vi.mocked(extractKnowledgeUrl).mockReset()
  })

  it('re-embeds a changed page as a new version with the page date', async () => {
    const source = await urlSource(new Date('2026-09-01'))
    vi.mocked(extractKnowledgeUrl).mockImplementation(async (target) =>
      target === source.sourceUrl
        ? { title: 'Pricing', content: 'Pricing page: Pro now costs 59 USD per month.', mimeType: 'text/html', validAsOf: new Date('2026-09-10') }
        : { title: null, content: 'unchanged elsewhere', mimeType: 'text/html', validAsOf: null },
    )
    await refreshKnowledgeSources(now)

    const updated = await db!.knowledgeSource.findUniqueOrThrow({ where: { id: source.id } })
    expect(updated).toMatchObject({ status: 'PENDING', version: 2, content: expect.stringContaining('59 USD') })
    expect(updated.validAsOf?.toISOString().slice(0, 10)).toBe('2026-09-10')
  })

  it('only moves fetchedAt when the page is unchanged, and skips fresh sources', async () => {
    const stale = await urlSource(new Date('2026-09-01'))
    const fresh = await urlSource(new Date('2026-09-23'))
    vi.mocked(extractKnowledgeUrl).mockResolvedValue({ title: null, content: stale.content, mimeType: 'text/html' })
    await refreshKnowledgeSources(now)

    const after = await db!.knowledgeSource.findUniqueOrThrow({ where: { id: stale.id } })
    expect(after).toMatchObject({ status: 'INDEXED', version: 1 })
    expect(after.fetchedAt!.getTime()).toBeGreaterThan(new Date('2026-09-01').getTime())
    expect(vi.mocked(extractKnowledgeUrl)).not.toHaveBeenCalledWith(fresh.sourceUrl)
  })

  it('keeps the last good index when a refresh fails', async () => {
    const source = await urlSource(new Date('2026-09-01'))
    vi.mocked(extractKnowledgeUrl).mockRejectedValue(new Error('Knowledge extraction failed: unreachable'))
    await refreshKnowledgeSources(now)

    const after = await db!.knowledgeSource.findUniqueOrThrow({ where: { id: source.id } })
    expect(after).toMatchObject({ status: 'INDEXED', version: 1, error: 'Knowledge extraction failed: unreachable' })
    expect(after.fetchedAt).toEqual(now)
  })

  it('requeues sources embedded by a retired model', async () => {
    const source = await urlSource(new Date('2026-09-23'))
    await db!.knowledgeSource.update({ where: { id: source.id }, data: { embeddingModel: 'text-embedding-ada-002' } })
    await refreshKnowledgeSources(now)
    expect(await db!.knowledgeSource.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({ status: 'PENDING' })
  })
})

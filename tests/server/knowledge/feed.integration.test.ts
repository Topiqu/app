// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { embed, embedMany, generateObject } from 'ai'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createDatabaseClient } from '../../../server/utils/database'
import { fetchPublicUrl } from '../../../server/utils/images/publicFetch'
import { retrieveKnowledge } from '../../../server/utils/knowledge/retrieve'
import { indexKnowledgeSource } from '../../../server/utils/knowledge/indexing'

vi.mock('ai', () => ({ embed: vi.fn(), embedMany: vi.fn(), generateObject: vi.fn() }))
vi.mock('../../../server/utils/images/publicFetch', async (original) => ({
  ...(await original<typeof import('../../../server/utils/images/publicFetch')>()),
  fetchPublicUrl: vi.fn(),
}))

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url) : null

const axis = (index: number) => Array.from({ length: 1536 }, (_, position) => (position === index ? 1 : 0))

type Item = { id: string; name: string; price: string; description?: string; delivery?: string }
const feed = (items: Item[]) =>
  `<SHOP>${items
    .map(
      (item) => `<SHOPITEM><ITEM_ID>${item.id}</ITEM_ID><PRODUCTNAME>${item.name}</PRODUCTNAME>
        <DESCRIPTION>${item.description ?? 'Kitchen tool.'}</DESCRIPTION>
        <URL>https://shop.example.test/${item.id}?utm_source=heureka</URL>
        <PRICE_VAT>${item.price}</PRICE_VAT><DELIVERY_DATE>${item.delivery ?? '0'}</DELIVERY_DATE></SHOPITEM>`,
    )
    .join('')}</SHOP>`

const serve = (xml: string) => vi.mocked(fetchPublicUrl).mockImplementation(async () => new Response(xml))

const feedSource = async (language: 'cs' | 'en' = 'cs') => {
  const clientSiteId = randomUUID()
  await db!.clientSite.create({
    data: { id: clientSiteId, name: `feed-${clientSiteId}`, domain: `${clientSiteId}.test`, plan: 'PRO' },
  })
  const source = await db!.knowledgeSource.create({
    data: {
      clientSiteId,
      kind: 'FEED',
      title: 'shop.example.test',
      sourceUrl: 'https://shop.example.test/feed.xml',
      content: '',
      contentHash: randomUUID().replace(/-/g, '').padEnd(64, '0'),
      language,
      currency: 'CZK',
    },
  })
  return { clientSiteId, id: source.id }
}

/** What the hourly refresh does for a due feed: queue it, then the index queue syncs it. */
const sync = async (id: string) => {
  await db!.knowledgeSource.update({ where: { id }, data: { status: 'PENDING', attempts: 0 } })
  return indexKnowledgeSource(id)
}

const embeddedTexts = () => vi.mocked(embedMany).mock.calls.flatMap(([options]) => options.values as string[])

describe.skipIf(!enabled)('knowledge product feeds on PostgreSQL', () => {
  beforeAll(() => {
    vi.stubGlobal('prisma', db)
    vi.stubGlobal('aiModel', () => 'test-model')
    vi.stubGlobal('aiEmbeddingModel', () => 'test-embedding')
    vi.stubGlobal('logAction', vi.fn())
    vi.stubGlobal('reportCaughtError', vi.fn())
  })
  afterAll(async () => {
    await db?.$disconnect()
    vi.unstubAllGlobals()
  })
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(embedMany).mockImplementation((async ({ values }: { values: string[] }) => ({
      embeddings: values.map(() => axis(0)),
      usage: { tokens: values.length },
    })) as never)
    vi.mocked(embed).mockResolvedValue({ embedding: axis(0), usage: { tokens: 3 } } as never)
    vi.mocked(generateObject).mockImplementation((async ({ prompt }: { prompt: string }) => ({
      object: { relevant: JSON.parse(prompt).excerpts.map((excerpt: { id: string }) => excerpt.id) },
      usage: { totalTokens: 7 },
    })) as never)
  })

  it('embeds only new or rewritten products and drops the ones gone from the feed', async () => {
    const { id } = await feedSource()
    serve(
      feed([
        { id: 'knife', name: 'Chef knife', price: '1299' },
        { id: 'board', name: 'Cutting board', price: '499' },
        { id: 'pan', name: 'Frying pan', price: '899' },
      ]),
    )
    expect(await sync(id)).toBe(true)
    expect(embeddedTexts()).toHaveLength(3)

    vi.mocked(embedMany).mockClear()
    serve(
      feed([
        { id: 'knife', name: 'Chef knife', price: '999' },
        { id: 'board', name: 'Cutting board', price: '499', description: 'Oak, 40 cm.' },
      ]),
    )
    await sync(id)

    expect(embeddedTexts()).toEqual([expect.stringContaining('Oak, 40 cm.')])
    const products = await db!.knowledgeProduct.findMany({ where: { sourceId: id }, orderBy: { externalId: 'asc' } })
    expect(products.map((product) => [product.externalId, String(product.price)])).toEqual([
      ['board', '499'],
      ['knife', '999'],
    ])
    expect(products[1]!.url).toBe('https://shop.example.test/knife')
    const [{ chunks }] = await db!.$queryRaw<{ chunks: number }[]>`
      SELECT count(*)::int AS chunks FROM "KnowledgeChunk" WHERE "sourceId" = ${id}`
    expect(chunks).toBe(2)
    expect(await db!.knowledgeSource.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'INDEXED',
      chunkCount: 2,
      syncReport: { items: 2, products: 2, skipped: {}, unpriced: 0, truncated: 0 },
    })

    vi.mocked(embedMany).mockClear()
    await sync(id)
    expect(embedMany).not.toHaveBeenCalled()
  })

  it('offers in-stock products of the article language with today’s price and their own link', async () => {
    const { clientSiteId, id } = await feedSource('cs')
    serve(
      feed([
        { id: 'knife', name: 'Chef knife', price: '1299' },
        { id: 'pan', name: 'Frying pan', price: '899', delivery: '' },
        { id: 'gone', name: 'Sold out pot', price: '10' },
      ]),
    )
    await sync(id)
    await db!.knowledgeProduct.updateMany({
      where: { sourceId: id, externalId: 'gone' },
      data: { availability: 'OUT_OF_STOCK' },
    })
    // A running sync must not take the catalog away from articles.
    await db!.knowledgeSource.update({ where: { id }, data: { status: 'PROCESSING' } })

    const czech = await retrieveKnowledge(clientSiteId, 'kitchen knives', { language: 'cs', track: false })
    expect(czech.brief).toContain('Chef knife')
    expect(czech.brief).not.toContain('Sold out pot')
    expect(czech.brief).toContain(
      `from ${new Intl.NumberFormat('cs', { style: 'currency', currency: 'CZK' }).format(1299)}`,
    )
    expect(czech.publicUrls).toContain('https://shop.example.test/knife')
    expect(czech.publicUrls).not.toContain('https://shop.example.test/feed.xml')

    const english = await retrieveKnowledge(clientSiteId, 'kitchen knives', { language: 'en', track: false })
    expect(english.brief).toBeNull()
  })

  it('keeps the last good catalog when a later sync fails', async () => {
    const { id } = await feedSource()
    serve(feed([{ id: 'knife', name: 'Chef knife', price: '1299' }]))
    await sync(id)

    serve('<html><body>Maintenance</body></html>')
    expect(await sync(id)).toBe(false)

    expect(await db!.knowledgeSource.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'INDEXED',
      chunkCount: 1,
      error: 'notFeed',
    })
    expect(await db!.knowledgeProduct.count({ where: { sourceId: id } })).toBe(1)
  })

  it('fails a link that is not a feed at once, but retries a network error', async () => {
    const { id } = await feedSource()
    serve('<html><body>Shop home</body></html>')
    await sync(id)
    expect(await db!.knowledgeSource.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'FAILED',
      error: 'notFeed',
    })

    vi.mocked(fetchPublicUrl).mockRejectedValue(new Error('ECONNRESET'))
    await sync(id)
    expect(await db!.knowledgeSource.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'PENDING',
      error: 'unreachable',
    })
    expect(reportCaughtError).not.toHaveBeenCalled()
  })
})

// @vitest-environment node
import { embedMany } from 'ai'
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { PolicyPlugin } from '@zenstackhq/plugin-policy'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(
    import('../../../server/utils/knowledge/extract'),
    'normalizeKnowledgeText',
    'extractKnowledgeUrl',
    'KnowledgeExtractError',
  )
  await stubNitroImports(import('../../../server/utils/knowledge/indexing'), 'indexKnowledgeSource')
  await stubNitroImports(
    import('../../../server/utils/knowledge/sources'),
    'assertCitableUrl',
    'hashKnowledge',
    'kickKnowledgeIndex',
    'KNOWLEDGE_SOURCE_VIEW',
    'requireKnowledgeAccess',
  )
  await stubNitroImports(import('../../../server/utils/images/publicFetch'), 'assertPublicHttpsUrl')
}

await stubImports()

const { createDatabaseClient } = await import('../../../server/utils/database')
const { fetchPublicUrl } = await import('../../../server/utils/images/publicFetch')
const { indexKnowledgeSource } = await import('../../../server/utils/knowledge/indexing')

vi.mock('ai', async (original) => ({ ...(await original<typeof import('ai')>()), embedMany: vi.fn() }))
vi.mock('../../../server/utils/images/publicFetch', async (original) => ({
  ...(await original<typeof import('../../../server/utils/images/publicFetch')>()),
  fetchPublicUrl: vi.fn(),
}))

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url) : null
const sites: string[] = []
const vector = Array.from({ length: 1536 }, (_, index) => (index === 0 ? 1 : 0))
const embeddings = { embeddings: [vector], usage: { tokens: 1 } }
const feed = (id: string) =>
  `<SHOP><SHOPITEM><ITEM_ID>${id}</ITEM_ID><PRODUCTNAME>${id}</PRODUCTNAME><DESCRIPTION>Product ${id}</DESCRIPTION><URL>https://shop.example.test/${id}</URL><PRICE_VAT>10</PRICE_VAT><DELIVERY_DATE>0</DELIVERY_DATE></SHOPITEM></SHOP>`
const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

const fixture = async (kind: 'NOTE' | 'FEED' = 'FEED') => {
  const clientSiteId = randomUUID()
  sites.push(clientSiteId)
  await db!.clientSite.create({
    data: { id: clientSiteId, name: `ownership-${clientSiteId}`, domain: `${clientSiteId}.test`, plan: 'PRO' },
  })
  return db!.knowledgeSource.create({
    data: {
      clientSiteId,
      kind,
      title: 'Catalog',
      content: 'A product document.',
      contentHash: '0'.repeat(64),
      sourceUrl: kind === 'FEED' ? 'https://shop.example.test/feed.xml' : null,
      currency: 'CZK',
    },
  })
}
const expireClaim = (id: string) => db!.$executeRaw`
  UPDATE "KnowledgeSource" SET "updatedAt" = now() - interval '11 minutes' WHERE "id" = ${id}`

const setAiFeature = async (clientSiteId: string, isActive: boolean) => {
  const feature = await db!.feature.upsert({
    where: { code: 'AI' },
    create: { code: 'AI', name: 'AI', priceMonthly: 0 },
    update: {},
  })
  await db!.clientFeature.upsert({
    where: { clientSiteId_featureId: { clientSiteId, featureId: feature.id } },
    create: { clientSiteId, featureId: feature.id, isActive, billingLockedUntil: new Date() },
    update: { isActive },
  })
}

describe.skipIf(!enabled)('knowledge indexing claim ownership on PostgreSQL', () => {
  beforeAll(() => {
    vi.stubGlobal('prisma', db)
    vi.stubGlobal('aiEmbeddingModel', () => 'test-embedding')
    vi.stubGlobal('logAction', vi.fn())
    vi.stubGlobal('reportCaughtError', vi.fn())
    vi.stubGlobal('recordAiUsage', vi.fn())
  })
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchPublicUrl).mockReset()
    vi.mocked(embedMany).mockReset()
    vi.mocked(embedMany).mockImplementation((async ({ values }: { values: string[] }) => ({
      embeddings: values.map(() => vector),
      usage: { tokens: values.length },
    })) as never)
  })
  afterAll(async () => {
    await db?.clientSite.deleteMany({ where: { id: { in: sites } } })
    await db?.$disconnect()
    vi.unstubAllGlobals()
  })

  for (const scenario of ['disabled', 'basic', 'custom-missing', 'custom-disabled', 'deleted'] as const) {
    it(`does not claim or pay for knowledge when tenant eligibility is ${scenario}`, async () => {
      const source = await fixture('NOTE')
      if (scenario.includes('disabled')) await setAiFeature(source.clientSiteId, false)
      await db!.clientSite.update({
        where: { id: source.clientSiteId },
        data: {
          ...(scenario === 'basic' ? { plan: 'BASIC' } : {}),
          ...(scenario.startsWith('custom') ? { plan: 'CUSTOM' } : {}),
          ...(scenario === 'deleted' ? { deletedAt: new Date() } : {}),
        },
      })
      expect(await indexKnowledgeSource(source.id)).toBe(false)
      expect(embedMany).not.toHaveBeenCalled()
      expect(fetchPublicUrl).not.toHaveBeenCalled()
      expect(await db!.knowledgeSource.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({
        status: 'PENDING',
        attempts: 0,
      })
    })
  }

  for (const [plan, active] of [
    ['PRO', null],
    ['PREMIUM', null],
    ['PRO', true],
    ['PREMIUM', true],
    ['CUSTOM', true],
  ] as const) {
    it(`indexes an eligible ${plan} tenant with ${active === null ? 'legacy missing' : 'explicit active'} AI`, async () => {
      const source = await fixture('NOTE')
      await db!.clientSite.update({ where: { id: source.clientSiteId }, data: { plan } })
      if (active !== null) await setAiFeature(source.clientSiteId, active)
      expect(await indexKnowledgeSource(source.id)).toBe(true)
      expect(embedMany).toHaveBeenCalledOnce()
    })
  }

  for (const kind of ['NOTE', 'FEED'] as const) {
    for (const transition of ['disabled', 'basic', 'deleted', 'source-deleted'] as const) {
      it(`discards an in-flight ${kind} result after eligibility changes to ${transition}`, async () => {
        const source = await fixture(kind)
        await setAiFeature(source.clientSiteId, true)
        vi.mocked(fetchPublicUrl).mockResolvedValueOnce(new Response(feed('current')))
        const waiting = deferred<typeof embeddings>()
        const started = deferred<undefined>()
        vi.mocked(embedMany).mockImplementationOnce(() => {
          started.resolve(undefined)
          return waiting.promise as never
        })
        const running = indexKnowledgeSource(source.id)
        await started.promise
        if (transition === 'disabled') await setAiFeature(source.clientSiteId, false)
        else if (transition === 'source-deleted')
          await db!.knowledgeSource.update({ where: { id: source.id }, data: { deletedAt: new Date() } })
        else
          await db!.clientSite.update({
            where: { id: source.clientSiteId },
            data: transition === 'deleted' ? { deletedAt: new Date() } : { plan: 'BASIC' },
          })
        waiting.resolve(embeddings)
        expect(await running).toBe(false)
        expect(recordAiUsage).toHaveBeenCalledOnce()
        expect(recordAiUsage).toHaveBeenCalledWith(
          source.clientSiteId,
          1,
          'KNOWLEDGE_EMBEDDING_TOKENS',
          expect.objectContaining({ sourceId: source.id, attempt: 1 }),
        )
        expect(await db!.knowledgeSource.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({
          status: 'PENDING',
          attempts: 0,
        })
        expect(await db!.$queryRaw`SELECT 1 FROM "KnowledgeChunk" WHERE "sourceId" = ${source.id}`).toEqual([])
        expect(await db!.$queryRaw`SELECT 1 FROM "KnowledgeProductStage" WHERE "sourceId" = ${source.id}`).toEqual([])
      })
    }
  }

  it('rejects a reclaimed feed worker before it can overwrite the newer catalog', async () => {
    const source = await fixture()
    const waiting = deferred<Response>()
    const started = deferred<undefined>()
    vi.mocked(fetchPublicUrl).mockImplementationOnce(() => {
      started.resolve(undefined)
      return waiting.promise
    })
    const old = indexKnowledgeSource(source.id)
    await started.promise
    await expireClaim(source.id)
    vi.mocked(fetchPublicUrl).mockResolvedValueOnce(new Response(feed('current')))
    expect(await indexKnowledgeSource(source.id)).toBe(true)
    const current = await db!.knowledgeSource.findUniqueOrThrow({ where: { id: source.id } })
    waiting.resolve(new Response(feed('obsolete')))
    expect(await old).toBe(false)
    expect(
      await db!.knowledgeProduct.findMany({ where: { sourceId: source.id }, select: { externalId: true } }),
    ).toEqual([{ externalId: 'current' }])
    expect(await db!.knowledgeSource.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({
      status: 'INDEXED',
      contentHash: current.contentHash,
      error: null,
    })
  })

  it('does not let an old document claim complete while its replacement is embedding', async () => {
    const source = await fixture('NOTE')
    const first = deferred<typeof embeddings>()
    const second = deferred<typeof embeddings>()
    const firstStarted = deferred<undefined>()
    const secondStarted = deferred<undefined>()
    vi.mocked(embedMany)
      .mockImplementationOnce(() => {
        firstStarted.resolve(undefined)
        return first.promise as never
      })
      .mockImplementationOnce(() => {
        secondStarted.resolve(undefined)
        return second.promise as never
      })
    const old = indexKnowledgeSource(source.id)
    await firstStarted.promise
    await expireClaim(source.id)
    const replacement = indexKnowledgeSource(source.id)
    await secondStarted.promise
    first.resolve(embeddings)
    expect(await old).toBe(false)
    expect(await db!.knowledgeSource.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({
      status: 'PROCESSING',
    })
    second.resolve(embeddings)
    expect(await replacement).toBe(true)
  })

  it('ignores a stale fetch failure after a replacement has indexed the feed', async () => {
    const source = await fixture()
    const waiting = deferred<Response>()
    const started = deferred<undefined>()
    vi.mocked(fetchPublicUrl).mockImplementationOnce(() => {
      started.resolve(undefined)
      return waiting.promise
    })
    const old = indexKnowledgeSource(source.id)
    await started.promise
    await expireClaim(source.id)
    vi.mocked(fetchPublicUrl).mockResolvedValueOnce(new Response(feed('current')))
    expect(await indexKnowledgeSource(source.id)).toBe(true)
    waiting.reject(new Error('Old network request failed'))
    expect(await old).toBe(false)
    expect(await db!.knowledgeSource.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({
      status: 'INDEXED',
      error: null,
    })
  })

  it('does not let a reclaimed embedding batch replace current product text or chunks', async () => {
    const source = await fixture()
    const waiting = deferred<typeof embeddings>()
    const started = deferred<undefined>()
    vi.mocked(fetchPublicUrl)
      .mockResolvedValueOnce(new Response(feed('shared').replace('Product shared', 'Product obsolete')))
      .mockResolvedValueOnce(new Response(feed('shared').replace('Product shared', 'Product current')))
    vi.mocked(embedMany).mockImplementationOnce(() => {
      started.resolve(undefined)
      return waiting.promise as never
    })
    const old = indexKnowledgeSource(source.id)
    await started.promise
    await expireClaim(source.id)
    expect(await indexKnowledgeSource(source.id)).toBe(true)
    const product = await db!.knowledgeProduct.findFirstOrThrow({ where: { sourceId: source.id } })
    waiting.resolve(embeddings)
    expect(await old).toBe(false)
    expect(await db!.knowledgeProduct.findFirstOrThrow({ where: { sourceId: source.id } })).toMatchObject({
      textHash: product.textHash,
    })
    const chunks = await db!.$queryRaw<
      { content: string }[]
    >`SELECT "content" FROM "KnowledgeChunk" WHERE "sourceId" = ${source.id}`
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.content).toContain('Product current')
  })

  it('finishes a deleted source as lost work without restoring it or its chunks', async () => {
    const source = await fixture('NOTE')
    const waiting = deferred<typeof embeddings>()
    const started = deferred<undefined>()
    vi.mocked(embedMany).mockImplementationOnce(() => {
      started.resolve(undefined)
      return waiting.promise as never
    })
    const running = indexKnowledgeSource(source.id)
    await started.promise
    await db!.knowledgeSource.delete({ where: { id: source.id } })
    waiting.resolve(embeddings)
    expect(await running).toBe(false)
    expect(await db!.knowledgeSource.findUnique({ where: { id: source.id } })).toBeNull()
    const chunks = await db!.$queryRaw<
      { count: number }[]
    >`SELECT count(*)::int AS count FROM "KnowledgeChunk" WHERE "sourceId" = ${source.id}`
    expect(chunks[0]!.count).toBe(0)
  })

  it('reindexes a title-only edit through the authorized route and embeds the new heading', async () => {
    const source = await fixture('NOTE')
    const user = { id: randomUUID(), role: 'admin' as const, clientSiteId: source.clientSiteId }
    const scoped = db!.$use(new PolicyPlugin()).$setAuth(user)
    vi.stubGlobal('requireTenantScope', async () => ({ user }))
    vi.stubGlobal('getEnhancedPrisma', async () => scoped)
    vi.stubGlobal('getRouterParam', () => source.id)
    vi.stubGlobal('getIp', () => '127.0.0.1')
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (body: unknown) => unknown) =>
      parse({ title: 'Current pricing' }),
    )
    const handler = (await import('../../../server/api/knowledge/[id].patch')).default
    await handler({} as never)
    await vi.waitFor(async () => {
      expect(await db!.knowledgeSource.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({
        version: 2,
        title: 'Current pricing',
        status: 'INDEXED',
      })
    })
    const chunks = await db!.$queryRaw<
      { content: string }[]
    >`SELECT "content" FROM "KnowledgeChunk" WHERE "sourceId" = ${source.id}`
    expect(chunks[0]!.content).toContain('Current pricing')
  })

  for (const kind of ['NOTE', 'FEED'] as const) {
    it(`keeps a committed ${kind} index successful when its audit transport fails`, async () => {
      const source = await fixture(kind)
      vi.mocked(fetchPublicUrl).mockResolvedValueOnce(new Response(feed('current')))
      vi.mocked(logAction).mockRejectedValueOnce(new Error('Synthetic audit failure'))
      expect(await indexKnowledgeSource(source.id)).toBe(true)
      expect(await db!.knowledgeSource.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({
        status: 'INDEXED',
        error: null,
      })
      expect(reportCaughtError).toHaveBeenCalledOnce()
    })
  }

  it('reserves the remaining tenant quota again before two feeds can both spend it', async () => {
    const first = await fixture()
    const second = await db!.knowledgeSource.create({
      data: {
        clientSiteId: first.clientSiteId,
        kind: 'FEED',
        title: 'Second feed',
        content: '',
        contentHash: '0'.repeat(64),
        sourceUrl: 'https://shop.example.test/second.xml',
        currency: 'CZK',
      },
    })
    const catalog = `<SHOP>${Array.from({ length: 300 }, (_, index) => feed(`product-${index}`).replace(/<\/?SHOP>/g, '')).join('')}</SHOP>`
    let requests = 0
    const bothFetched = deferred<undefined>()
    vi.mocked(fetchPublicUrl).mockImplementation(async () => {
      if (++requests === 2) bothFetched.resolve(undefined)
      await bothFetched.promise
      return new Response(catalog)
    })
    const results = await Promise.all([indexKnowledgeSource(first.id), indexKnowledgeSource(second.id)])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(vi.mocked(embedMany).mock.calls.flatMap(([options]) => options.values)).toHaveLength(300)
    expect(await db!.knowledgeProduct.count({ where: { clientSiteId: first.clientSiteId } })).toBe(300)
    const queued = results[0] ? second.id : first.id
    expect(await db!.knowledgeSource.findUniqueOrThrow({ where: { id: queued } })).toMatchObject({ status: 'PENDING' })
    expect(await indexKnowledgeSource(queued)).toBe(true)
    expect(await db!.knowledgeProduct.count({ where: { clientSiteId: first.clientSiteId } })).toBe(500)
    expect(vi.mocked(embedMany).mock.calls.flatMap(([options]) => options.values)).toHaveLength(500)
  })
})

beforeEach(stubImports)

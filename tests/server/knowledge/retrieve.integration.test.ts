// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { embed, embedMany, generateObject } from 'ai'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createDatabaseClient } from '../../../server/utils/database'
import { aiEmbeddingModelId } from '../../../server/utils/ai/modelRegistry'
import { indexKnowledgeSource, toPgVector } from '../../../server/utils/knowledge/indexing'
import { knowledgeSearchTerms, retrieveKnowledge, searchKnowledge } from '../../../server/utils/knowledge/retrieve'

vi.mock('ai', () => ({ embed: vi.fn(), embedMany: vi.fn(), generateObject: vi.fn() }))

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url) : null

const axis = (index: number) => Array.from({ length: 1536 }, (_, position) => (position === index ? 1 : 0))

const tenant = async () => {
  const id = randomUUID()
  await db!.clientSite.create({ data: { id, name: `knowledge-${id}`, domain: `${id}.test` } })
  return id
}

const indexedSource = async (clientSiteId: string, content: string, vector: number[], extra: object = {}) => {
  const source = await db!.knowledgeSource.create({
    data: { clientSiteId, kind: 'NOTE', title: 'Note', content, contentHash: randomUUID().replace(/-/g, '').padEnd(64, '0'), ...extra },
  })
  vi.mocked(embedMany).mockResolvedValueOnce({ embeddings: [vector], usage: { tokens: 5 } } as never)
  await indexKnowledgeSource(source.id)
  return source.id
}

/** An indexed source with one chunk per entry, written directly so a corpus of hundreds stays fast. */
const chunkedSource = async (clientSiteId: string, chunks: string[], embeddingModel = aiEmbeddingModelId('knowledge')) => {
  const source = await db!.knowledgeSource.create({
    data: {
      clientSiteId,
      kind: 'NOTE',
      title: 'Corpus',
      content: chunks.join('\n'),
      contentHash: randomUUID().replace(/-/g, '').padEnd(64, '0'),
      status: 'INDEXED',
      embeddingModel,
    },
  })
  await db!.$executeRaw`
    INSERT INTO "KnowledgeChunk" ("id", "sourceId", "clientSiteId", "version", "ordinal", "content", "embedding")
    SELECT gen_random_uuid()::text, ${source.id}, ${clientSiteId}, 1, t.ordinal, t.content, ${toPgVector(axis(1))}::vector
    FROM unnest(${chunks.map((_, index) => index)}::int[], ${chunks}::text[]) AS t(ordinal, content)`
  return source.id
}

const lexicalHits = async (clientSiteId: string, query: string) =>
  (await searchKnowledge(clientSiteId, axis(0), knowledgeSearchTerms(query)))
    .filter((candidate) => candidate.lexicalRank !== null)
    .map((candidate) => candidate.content)

describe.skipIf(!enabled)('knowledge retrieval on PostgreSQL', () => {
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
    vi.mocked(embed).mockResolvedValue({ embedding: axis(0), usage: { tokens: 3 } } as never)
    vi.mocked(generateObject).mockImplementation((async ({ prompt }: { prompt: string }) => ({
      object: { relevant: JSON.parse(prompt).excerpts.map((excerpt: { id: string }) => excerpt.id) },
      usage: { totalTokens: 7 },
    })) as never)
  })

  it('never returns another tenant’s chunks, even with an identical embedding', async () => {
    const [mine, theirs] = [await tenant(), await tenant()]
    await indexedSource(mine, 'Our customers leave manual WordPress approval, which takes two hours a week.', axis(0))
    await indexedSource(theirs, 'Competitor secret: their churn doubled last quarter, confidential.', axis(0))

    const result = await retrieveKnowledge(mine, 'content operations approval')

    expect(result.brief).toContain('WordPress approval')
    expect(result.brief).not.toContain('Competitor secret')
    expect(result.used).toHaveLength(1)
    expect(result.tokens).toBe(10)
  })

  it('ignores sources switched off, mid-reindex or unrelated to the topic', async () => {
    const site = await tenant()
    await indexedSource(site, 'Pricing starts at 29 USD per month for the Pro plan.', axis(0))
    const disabled = await indexedSource(site, 'Disabled source that must stay out of articles.', axis(0))
    await db!.knowledgeSource.update({ where: { id: disabled }, data: { useInArticles: false } })
    const edited = await indexedSource(site, 'Old wording of an edited note, awaiting reindex.', axis(0))
    await db!.knowledgeSource.update({ where: { id: edited }, data: { version: 2, status: 'PENDING' } })
    await indexedSource(site, 'Office dog policy and parking rules for the Prague office.', axis(1))

    const candidates = await searchKnowledge(site, axis(0), ['pricing'])
    expect(candidates.map((candidate) => candidate.content)).toEqual([
      expect.stringContaining('Pricing starts at 29 USD'),
      expect.stringContaining('Office dog policy'),
    ])

    const result = await retrieveKnowledge(site, 'pricing')
    expect(result.brief).toContain('Pricing starts at 29 USD')
    expect(result.brief).not.toMatch(/Disabled source|Old wording|Office dog/)
  })

  it('keeps an exact full-text match whose embedding is unrelated', async () => {
    const site = await tenant()
    await indexedSource(site, 'The Growthplus plan includes forty articles a month.', axis(1))
    await indexedSource(site, 'Office dog policy and parking rules for the Prague office.', axis(2))

    const result = await retrieveKnowledge(site, 'Growthplus')
    expect(result.brief).toContain('Growthplus plan')
    expect(result.brief).not.toContain('Office dog')
  })

  it('folds query terms exactly like the index, whichever side carries the accent', async () => {
    const site = await tenant()
    await chunkedSource(site, ['Cena planu Pro to 199 złotych miesięcznie.', 'Lieferung in jede Strasse innerhalb von 48 Stunden.'])

    expect(await lexicalHits(site, 'zlotych')).toEqual([expect.stringContaining('złotych')])
    expect(await lexicalHits(site, 'złotych')).toEqual([expect.stringContaining('złotych')])
    expect(await lexicalHits(site, 'Straße')).toEqual([expect.stringContaining('Strasse')])
  })

  it('drops terms most of the corpus shares, keeping the rare one', async () => {
    const site = await tenant()
    await chunkedSource(site, [
      ...Array.from({ length: 60 }, (_, index) => `Topiqu blog note number ${index} about publishing.`),
      'Topiqu retired the legacy plan GRWPLS on its blog in March.',
    ])

    const hits = await lexicalHits(site, 'Topiqu GRWPLS')
    expect(hits).toEqual([expect.stringContaining('GRWPLS')])
  })

  it('keeps the rarest term when every term is common', async () => {
    const site = await tenant()
    await chunkedSource(site, [
      ...Array.from({ length: 40 }, (_, index) => `Topiqu blog note ${index}.`),
      ...Array.from({ length: 30 }, (_, index) => `Topiqu changelog entry ${index}.`),
    ])

    const hits = await lexicalHits(site, 'Topiqu changelog')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((content) => content.includes('changelog'))).toBe(true)
  })

  it('filters nothing in a small corpus, where shares are too coarse', async () => {
    const site = await tenant()
    await chunkedSource(site, Array.from({ length: 10 }, (_, index) => `Topiqu note ${index}.`))

    expect(await lexicalHits(site, 'Topiqu')).toHaveLength(10)
  })

  it('never compares vectors from a different embedding model', async () => {
    const site = await tenant()
    await chunkedSource(site, ['Pricing written by a retired embedding model.'], 'retired-embedding-model')

    expect(await searchKnowledge(site, axis(1), ['pricing'])).toEqual([])
  })

  it('counts real usage but not playground queries', async () => {
    const site = await tenant()
    const id = await indexedSource(site, 'Approval workflows take two hours a week for most customers.', axis(0))

    await retrieveKnowledge(site, 'approvals', { track: false })
    expect(await db!.knowledgeSource.findUnique({ where: { id }, select: { usageCount: true } })).toEqual({ usageCount: 0 })

    await retrieveKnowledge(site, 'approvals')
    const tracked = await db!.knowledgeSource.findUnique({ where: { id }, select: { usageCount: true, lastUsedAt: true } })
    expect(tracked?.usageCount).toBe(1)
    expect(tracked?.lastUsedAt).toBeInstanceOf(Date)
  })

  it('skips the model call entirely when the tenant has nothing indexed', async () => {
    const result = await retrieveKnowledge(await tenant(), 'anything')
    expect(result).toEqual({ brief: null, publicUrls: [], used: [], tokens: 0 })
    expect(embed).not.toHaveBeenCalled()
  })

  it('replaces a source’s chunks atomically when it is reindexed', async () => {
    const site = await tenant()
    const id = await indexedSource(site, 'First version of the positioning statement for Topiqu.', axis(0))
    await db!.knowledgeSource.update({
      where: { id },
      data: { content: 'Second version of the positioning statement for Topiqu.', version: 2, status: 'PENDING' },
    })
    vi.mocked(embedMany).mockResolvedValueOnce({ embeddings: [axis(0)], usage: { tokens: 5 } } as never)
    await indexKnowledgeSource(id)

    const candidates = await searchKnowledge(site, axis(0), [])
    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({ version: 2, content: expect.stringContaining('Second version') })
  })
})

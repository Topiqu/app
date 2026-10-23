// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import type { DatabaseClient } from '../../server/utils/database'

const databaseFactory = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('Unexpected eager database access')
  }),
)
vi.mock('../../server/utils/database', () => ({ createDatabaseClient: databaseFactory }))

type Phase = 'articles' | 'translations' | 'drafts'
const document = (id: string, clientSiteId = 'site-1', content = '<img src="https://images.test/one.webp">') => ({
  id,
  clientSiteId,
  language: 'cs',
  articleId: 'parent',
  content,
  imageUrl: null as string | null,
  coverMediaId: null as string | null,
  deletedAt: null as Date | null,
})
const asset = (id: string, clientSiteId = 'site-1') => ({
  id,
  clientSiteId,
  url: `https://images.test/${id}.webp`,
  deliveryUrl: null,
  name: null,
  originalFilename: null,
  storageKey: null,
  defaultAltText: null,
  machineTags: [],
  searchText: '',
  author: 'Original author',
  license: 'Original license',
  origin: 'OWN',
  rightsConfirmedAt: new Date('2026-01-01'),
  archivedAt: new Date('2026-01-02'),
  purgeAfter: new Date('2026-01-09'),
  purgedAt: null,
  deletedAt: null,
  updatedAt: null,
})

const fixture = (
  input: {
    assets?: ReturnType<typeof asset>[]
    articles?: ReturnType<typeof document>[]
    translations?: ReturnType<typeof document>[]
    drafts?: ReturnType<typeof document>[]
    failUsage?: boolean
  } = {},
) => {
  const state = { assets: input.assets ?? [], usages: [] as Record<string, unknown>[] }
  type Query = { where?: Record<string, unknown>; take: number; select?: Record<string, unknown> }
  const calls: { model: string; args: Query }[] = []
  const rows = { articles: input.articles ?? [], translations: input.translations ?? [], drafts: input.drafts ?? [] }
  const matches = (row: Record<string, unknown>, where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([key, value]) => {
      if (key === 'clientSite' || key === 'article') return true
      if (key === 'OR') return (value as Record<string, unknown>[]).some((condition) => matches(row, condition))
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        if ('gt' in value) return String(row[key]) > String(value.gt)
        if ('in' in value && Array.isArray(value.in)) return value.in.includes(row[key])
      }
      return row[key] === value
    })
  const findMany = (model: string, getRows: () => Record<string, unknown>[]) =>
    vi.fn(async (args: Query) => {
      calls.push({ model, args })
      return getRows()
        .filter((row) => matches(row, args.where ?? {}))
        .sort((a, b) => String(a.id).localeCompare(String(b.id)))
        .slice(0, args.take)
        .map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => args.select?.[key])))
    })
  const db = {
    mediaAsset: {
      findMany: findMany('assets', () => state.assets),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...asset(String(data.id)), ...data }
        state.assets.push(row)
        return row
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const found = state.assets.filter((row) => matches(row, where))
        found.forEach((row) => Object.assign(row, data))
        return { count: found.length }
      }),
    },
    article: { findMany: findMany('articles', () => rows.articles) },
    articleTranslation: { findMany: findMany('translations', () => rows.translations) },
    articleDraft: { findMany: findMany('drafts', () => rows.drafts) },
    $queryRawUnsafe: vi.fn(async (sql: string, id: string, tenantId: string, maximum: number) => {
      const phase: Phase = sql.includes('FROM "ArticleTranslation"')
        ? 'translations'
        : sql.includes('FROM "ArticleDraft"')
          ? 'drafts'
          : 'articles'
      const row = rows[phase].find(
        (entry) => entry.id === id && entry.clientSiteId === tenantId && entry.deletedAt === null,
      )
      if (!row) return []
      const oversized = Buffer.byteLength(row.content) > maximum
      return [
        {
          ...row,
          articleId: phase === 'translations' ? row.articleId : row.id,
          content: oversized ? null : row.content,
          oversized,
        },
      ]
    }),
    $queryRaw: vi.fn(async () => [{ id: 'parent' }]),
    articleMediaUsage: {
      deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        state.usages = state.usages.filter((row) => !matches(row, where))
        return { count: 1 }
      }),
      createMany: vi.fn(async ({ data }: { data: Record<string, unknown>[] }) => {
        if (input.failUsage) throw new Error('Usage write failed')
        state.usages.push(...data)
        return { count: data.length }
      }),
    },
    $transaction: vi.fn(async (run: (tx: unknown) => Promise<unknown>) => {
      const snapshot = structuredClone(state)
      try {
        return await run(db)
      } catch (error) {
        Object.assign(state, snapshot)
        throw error
      }
    }),
  }
  return { db: db as unknown as DatabaseClient, methods: db, state, calls }
}

describe('bounded media maintenance', () => {
  it('is import-safe and exposes an explicitly invoked dry-run maintenance function', async () => {
    const module = await import('../../scripts/backfill-media-library')
    expect(module.backfillMediaLibrary).toBeTypeOf('function')
    expect(databaseFactory).not.toHaveBeenCalled()
  })

  it('uses a shared row budget, bounded identity pages and resumable phases without dry-run writes', async () => {
    const { backfillMediaLibrary } = await import('../../scripts/backfill-media-library')
    const f = fixture({
      assets: [asset('m0'), asset('m1'), asset('m2')],
      articles: Array.from({ length: 5 }, (_, i) => document(`a${i}`)),
      translations: Array.from({ length: 3 }, (_, i) => document(`t${i}`)),
      drafts: Array.from({ length: 4 }, (_, i) => document(`d${i}`)),
    })
    const first = await backfillMediaLibrary(f.db, { limit: 5, batchSize: 2 })
    expect(first).toMatchObject({ scanned: 5, nextCursor: 'articles:a1' })
    const next = await backfillMediaLibrary(f.db, { limit: 5, batchSize: 2, after: first.nextCursor! })
    expect(next).toMatchObject({ scanned: 5, nextCursor: 'translations:t1' })
    for (const { model, args } of f.calls) {
      expect(args.take).toBeLessThanOrEqual(model === 'assets' && args.where?.OR ? 1001 : 2)
      if (model !== 'assets') expect(args.select).not.toHaveProperty('content')
      expect(args.select).not.toHaveProperty('articles')
      expect(args.select).not.toHaveProperty('translations')
    }
    expect(f.methods.$transaction).not.toHaveBeenCalled()
    expect(f.methods.mediaAsset.create).not.toHaveBeenCalled()
    expect(f.methods.mediaAsset.updateMany).not.toHaveBeenCalled()
    expect(f.methods.articleMediaUsage.deleteMany).not.toHaveBeenCalled()
  })

  it('rejects invalid limits, cursors and tenant scopes before querying', async () => {
    const { backfillMediaLibrary } = await import('../../scripts/backfill-media-library')
    const f = fixture()
    for (const options of [
      { limit: Infinity },
      { batchSize: 0 },
      { after: 'unknown:any' },
      { after: 'articles:' },
      { clientSiteId: '' },
    ])
      await expect(backfillMediaLibrary(f.db, options)).rejects.toThrow()
    expect(f.calls).toHaveLength(0)
    expect(f.methods.$queryRawUnsafe).not.toHaveBeenCalled()
  })

  it('preserves rights and archive metadata while persisting missing search enrichment', async () => {
    const { backfillMediaLibrary } = await import('../../scripts/backfill-media-library')
    const original = asset('licensed')
    const f = fixture({ assets: [original] })
    const result = await backfillMediaLibrary(f.db, { apply: true })
    expect(result).toMatchObject({ enriched: 1 })
    expect(f.state.assets[0]).toMatchObject({
      origin: 'OWN',
      author: 'Original author',
      license: 'Original license',
      rightsConfirmedAt: original.rightsConfirmedAt,
      archivedAt: original.archivedAt,
      purgeAfter: original.purgeAfter,
      deliveryUrl: original.url,
      originalFilename: 'licensed.webp',
    })
    expect(f.state.assets[0]!.searchText).toContain('Original author'.toLowerCase())
    const data = f.methods.mediaAsset.updateMany.mock.calls[0]![0].data
    for (const key of ['origin', 'rightsConfirmedAt', 'archivedAt', 'purgeAfter']) expect(data).not.toHaveProperty(key)
  })

  it('rebuilds cover/body counts atomically and is idempotent without adopting another tenant asset', async () => {
    const { backfillMediaLibrary } = await import('../../scripts/backfill-media-library')
    const other = asset('foreign', 'site-2')
    other.url = 'https://images.test/one.webp'
    const row = document(
      'article-1',
      'site-1',
      '<img src="https://images.test/one.webp"><img src="https://images.test/one.webp">',
    )
    row.imageUrl = other.url
    row.coverMediaId = other.id
    const f = fixture({ assets: [other], articles: [row] })
    f.state.usages.push({ id: 'other-language', articleId: row.id, clientSiteId: 'site-1', language: 'en' })
    const first = await backfillMediaLibrary(f.db, { apply: true, clientSiteId: 'site-1' })
    expect(first).toMatchObject({ created: 1, usages: 2 })
    expect(f.state.assets.filter((entry) => entry.clientSiteId === 'site-1')).toHaveLength(1)
    expect(f.state.usages.filter((entry) => entry.language === 'cs')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ placement: 'COVER', occurrenceCount: 1 }),
        expect.objectContaining({ placement: 'BODY', occurrenceCount: 2 }),
      ]),
    )
    expect(f.state.usages.every((entry) => entry.mediaAssetId !== other.id)).toBe(true)
    const again = await backfillMediaLibrary(f.db, { apply: true, clientSiteId: 'site-1' })
    expect(again).toMatchObject({ created: 0, usages: 2 })
    expect(f.state.usages).toHaveLength(3)
  })

  it('rolls back new assets and usage deletion when replacement fails', async () => {
    const { backfillMediaLibrary } = await import('../../scripts/backfill-media-library')
    const f = fixture({ articles: [document('article-1')], failUsage: true })
    const prior = { id: 'prior', clientSiteId: 'site-1', articleId: 'article-1', language: 'cs', placement: 'BODY' }
    f.state.usages.push(prior)
    await expect(backfillMediaLibrary(f.db, { apply: true })).rejects.toThrow('Usage write failed')
    expect(f.state.assets).toHaveLength(0)
    expect(f.state.usages).toEqual([prior])
  })

  it('leaves oversized documents and their prior usage index untouched', async () => {
    const { backfillMediaLibrary } = await import('../../scripts/backfill-media-library')
    const f = fixture({
      drafts: [document('large', 'site-1', 'x'.repeat(1024 * 1024 + 1))],
      articles: [document('many', 'site-1', '<img src="https://images.test/one.webp">'.repeat(1001))],
    })
    f.state.usages.push({ id: 'prior', articleId: 'many', clientSiteId: 'site-1', language: 'cs' })
    await expect(backfillMediaLibrary(f.db, { apply: true })).resolves.toMatchObject({ oversized: 2, created: 0 })
    expect(f.state.usages).toHaveLength(1)
    expect(f.methods.mediaAsset.create).not.toHaveBeenCalled()
    expect(f.methods.articleMediaUsage.deleteMany).not.toHaveBeenCalled()
  })

  it('leaves ambiguous same-URL rights records untouched until the document supplies an explicit media ID', async () => {
    const { backfillMediaLibrary } = await import('../../scripts/backfill-media-library')
    const first = asset('first')
    const second = asset('second')
    first.url = second.url = 'https://images.test/shared.webp'
    const row = document('article-1', 'site-1', '<img src="https://images.test/shared.webp">')
    const f = fixture({ assets: [first, second], articles: [row] })
    f.state.usages.push({ id: 'prior', clientSiteId: 'site-1', articleId: row.id, language: 'cs' })
    await expect(backfillMediaLibrary(f.db, { apply: true })).resolves.toMatchObject({ ambiguous: 1, created: 0 })
    expect(f.state.usages[0]!.id).toBe('prior')
    row.content = '<img src="https://images.test/shared.webp" data-media-id="first">'
    await expect(backfillMediaLibrary(f.db, { apply: true })).resolves.toMatchObject({ ambiguous: 0, usages: 1 })
    expect(f.state.usages[0]!.mediaAssetId).toBe('first')
  })

  it('indexes the current locked document after an edit between its identity page and body read', async () => {
    const { backfillMediaLibrary } = await import('../../scripts/backfill-media-library')
    const row = document('article-1')
    const f = fixture({ articles: [row] })
    const read = f.methods.article.findMany.getMockImplementation()!
    f.methods.article.findMany.mockImplementationOnce(async (args) => {
      const identities = await read(args)
      row.content = '<img src="https://images.test/current.webp">'
      return identities
    })
    await expect(backfillMediaLibrary(f.db, { apply: true })).resolves.toMatchObject({ created: 1, conflicted: 0 })
    expect(f.state.assets[0]!.url).toBe('https://images.test/current.webp')
  })

  it('preserves the prior index if a document is deleted after its identity was selected', async () => {
    const { backfillMediaLibrary } = await import('../../scripts/backfill-media-library')
    const row = document('article-1')
    const f = fixture({ articles: [row] })
    const read = f.methods.article.findMany.getMockImplementation()!
    f.methods.article.findMany.mockImplementationOnce(async (args) => {
      const identities = await read(args)
      row.deletedAt = new Date()
      return identities
    })
    f.state.usages.push({ id: 'prior', clientSiteId: 'site-1', articleId: row.id, language: 'cs' })
    await expect(backfillMediaLibrary(f.db, { apply: true })).resolves.toMatchObject({ conflicted: 1, created: 0 })
    expect(f.state.usages[0]!.id).toBe('prior')
  })

  it('bounds the dry-run identity set and resumes before a document that would exceed its new-asset budget', async () => {
    const { backfillMediaLibrary } = await import('../../scripts/backfill-media-library')
    const articles = Array.from({ length: 41 }, (_, index) =>
      document(
        `a${String(index).padStart(2, '0')}`,
        'site-1',
        Array.from({ length: 500 }, (_, image) => `<img src="https://images.test/${index}-${image}.webp">`).join(''),
      ),
    )
    const f = fixture({ articles })
    const first = await backfillMediaLibrary(f.db)
    expect(first).toMatchObject({
      scanned: 40,
      created: 20_000,
      nextCursor: 'articles:a39',
      stopReason: 'asset-budget',
    })
    await expect(backfillMediaLibrary(f.db, { after: first.nextCursor! })).resolves.toMatchObject({
      scanned: 1,
      created: 500,
      nextCursor: null,
      stopReason: 'complete',
    })
    expect(f.methods.mediaAsset.create).not.toHaveBeenCalled()
  })
})

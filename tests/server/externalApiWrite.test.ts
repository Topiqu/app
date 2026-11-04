import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../helpers/nitroImports'

await stubNitroImports(import('../../server/utils/articleViewerAccess'), 'publicArticleWhere')
await stubNitroImports(import('../../server/utils/externalApi'), 'externalArticleSelect')

const v1 = await import('../../server/utils/externalApiV1')
const generations = await import('../../server/utils/apiGenerations')

const key = (scopes: string[]) => ({ id: 'key-1', clientSiteId: 'site-1', scopes, createdById: 'user-1', plan: 'PRO' })

const stubRoute = (input: unknown, scopes: string[]) => {
  const calls = {
    createArticle: vi.fn().mockResolvedValue({ id: 'article-1', status: 'draft' }),
    updateArticle: vi.fn().mockResolvedValue({ success: true, editVersion: 4 }),
    actAsApiKeyMember: vi.fn().mockResolvedValue({ id: 'user-1' }),
    logApiAction: vi.fn().mockResolvedValue(undefined),
    setResponseStatus: vi.fn(),
    setResponseHeader: vi.fn(),
    requireTenantScope: vi.fn().mockResolvedValue({}),
  }
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('requireApiKey', async () => ({ key: key(scopes) }))
  vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (value: unknown) => unknown) => parse(input))
  vi.stubGlobal('getRouterParam', () => 'article-1')
  vi.stubGlobal('withIdempotency', (_e: unknown, _k: unknown, _b: unknown, run: () => unknown) => run())
  vi.stubGlobal('loadOwnedArticleV1', async (_site: string, id: string) => ({ id }))
  vi.stubGlobal('resolveTagSlugs', async (_site: string, slugs?: string[]) => slugs?.map((slug) => `id-${slug}`))
  for (const name of ['apiArticleCreateSchema', 'apiArticleUpdateSchema', 'apiGenerationSchema'] as const)
    vi.stubGlobal(name, v1[name])
  vi.stubGlobal('requiresPublishScope', v1.requiresPublishScope)
  vi.stubGlobal('requirePublishScope', v1.requirePublishScope)
  for (const [name, fn] of Object.entries(calls)) vi.stubGlobal(name, fn)
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('GET /api/v1/articles/:id with draft access', () => {
  it('revalidates the creator and uses their policy-enhanced database', async () => {
    const calls = stubRoute({}, ['READ', 'WRITE'])
    const db = { article: {} }
    const load = vi.fn().mockResolvedValue({ id: 'article-1', status: 'draft' })
    vi.stubGlobal('loadOwnedArticleV1', load)
    vi.stubGlobal('getEnhancedPrisma', vi.fn().mockResolvedValue(db))
    const route = (await import('../../server/api/v1/articles/[id].get')).default
    await expect(route({} as never)).resolves.toMatchObject({ data: { status: 'draft' } })
    expect(calls.actAsApiKeyMember).toHaveBeenCalledOnce()
    expect(calls.requireTenantScope).toHaveBeenCalledWith({}, 'ARTICLE_WRITE', 'site-1')
    expect(load).toHaveBeenCalledWith('site-1', 'article-1', db)
  })

  it('does not load a draft when the creator loses permission', async () => {
    const calls = stubRoute({}, ['READ', 'WRITE'])
    const load = vi.fn()
    vi.stubGlobal('loadOwnedArticleV1', load)
    calls.requireTenantScope.mockRejectedValueOnce(createError({ statusCode: 403 }))
    const route = (await import('../../server/api/v1/articles/[id].get')).default
    await expect(route({} as never)).rejects.toMatchObject({ statusCode: 403 })
    expect(load).not.toHaveBeenCalled()
  })
})

describe('POST /api/v1/articles', () => {
  const route = async () => (await import('../../server/api/v1/articles.post')).default as (e: unknown) => unknown

  it('creates a draft through the editor path as the key member, with tags by slug', async () => {
    const calls = stubRoute({ title: 'Hello', content: '<p>Hi</p>', tags: ['seo'] }, ['READ', 'WRITE'])
    await expect((await route())({})).resolves.toEqual({ data: { id: 'article-1' } })
    expect(calls.actAsApiKeyMember).toHaveBeenCalledOnce()
    expect(calls.createArticle).toHaveBeenCalledWith(
      {},
      { title: 'Hello', content: '<p>Hi</p>', status: 'draft', tags: ['id-seo'] },
    )
    expect(calls.logApiAction).toHaveBeenCalledWith({}, expect.anything(), 'API_ARTICLE_CREATED', {
      articleId: 'article-1',
      status: 'draft',
    })
  })

  it.each([{ status: 'published' }, { releaseAt: '2026-12-01T10:00:00Z' }])(
    'needs the PUBLISH scope to publish or schedule (%o)',
    async (extra) => {
      const calls = stubRoute({ title: 'Hello', content: '<p>Hi</p>', ...extra }, ['READ', 'WRITE'])
      await expect((await route())({})).rejects.toMatchObject({ statusCode: 403 })
      expect(calls.createArticle).not.toHaveBeenCalled()
    },
  )

  it('rejects fields the editor owns', async () => {
    const calls = stubRoute({ title: 'Hello', aiInvolvement: 'NONE', userId: 'someone' }, ['READ', 'WRITE'])
    await expect((await route())({})).rejects.toBeTruthy()
    expect(calls.createArticle).not.toHaveBeenCalled()
  })
})

describe('GET /api/v1/generations/:id', () => {
  it('checks current creator permissions before reading private generation state', async () => {
    const calls = stubRoute({}, ['READ', 'GENERATE'])
    const findFirst = vi.fn().mockResolvedValue({ id: 'gen-1' })
    vi.stubGlobal('getEnhancedPrisma', async () => ({ apiGeneration: { findFirst } }))
    vi.stubGlobal('getRouterParam', () => 'gen-1')
    vi.stubGlobal('API_GENERATION_VIEW', generations.API_GENERATION_VIEW)
    vi.stubGlobal('serializeApiGeneration', (value: unknown) => value)
    const route = (await import('../../server/api/v1/generations/[id].get')).default
    await expect(route({} as never)).resolves.toEqual({ data: { id: 'gen-1' } })
    expect(calls.requireTenantScope).toHaveBeenCalledWith({}, 'AI_USE', 'site-1')
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'gen-1', clientSiteId: 'site-1' } }))
  })

  it('rejects removed or seat-paused creators before querying generation data', async () => {
    const calls = stubRoute({}, ['READ', 'GENERATE'])
    const findFirst = vi.fn()
    vi.stubGlobal('getEnhancedPrisma', async () => ({ apiGeneration: { findFirst } }))
    calls.actAsApiKeyMember.mockRejectedValueOnce(createError({ statusCode: 403 }))
    const route = (await import('../../server/api/v1/generations/[id].get')).default
    await expect(route({} as never)).rejects.toMatchObject({ statusCode: 403 })
    expect(findFirst).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/v1/articles/:id', () => {
  const route = async () => (await import('../../server/api/v1/articles/[id].patch')).default as (e: unknown) => unknown
  beforeEach(() => vi.stubGlobal('prisma', { article: { findFirst: vi.fn().mockResolvedValue({ editVersion: 3 }) } }))

  it('edits against the version it just read when none is given', async () => {
    const calls = stubRoute({ title: 'New', tags: [] }, ['READ', 'WRITE'])
    vi.stubGlobal('prisma', { article: { findFirst: vi.fn().mockResolvedValue({ editVersion: 3 }) } })
    await (
      await route()
    )({})
    expect(calls.updateArticle).toHaveBeenCalledWith({}, 'article-1', {
      title: 'New',
      tagIds: [],
      expectedVersion: 3,
    })
  })

  it('passes an explicit version through, so a stale write conflicts', async () => {
    const calls = stubRoute({ content: '<p>x</p>', expectedVersion: 1 }, ['READ', 'WRITE'])
    vi.stubGlobal('prisma', { article: { findFirst: vi.fn().mockResolvedValue({ editVersion: 3 }) } })
    await (
      await route()
    )({})
    expect(calls.updateArticle).toHaveBeenCalledWith({}, 'article-1', { content: '<p>x</p>', expectedVersion: 1 })
  })

  it.each([{ status: 'draft' }, { status: 'published' }, { releaseAt: null }])(
    'needs the PUBLISH scope to change publication (%o)',
    async (body) => {
      const calls = stubRoute(body, ['READ', 'WRITE'])
      await expect((await route())({})).rejects.toMatchObject({ statusCode: 403 })
      expect(calls.updateArticle).not.toHaveBeenCalled()
    },
  )

  it('answers 404 for an article of another site', async () => {
    const calls = stubRoute({ title: 'New' }, ['READ', 'WRITE'])
    vi.stubGlobal('prisma', { article: { findFirst: vi.fn().mockResolvedValue(null) } })
    await expect((await route())({})).rejects.toMatchObject({ statusCode: 404 })
    expect(calls.updateArticle).not.toHaveBeenCalled()
  })

  it('refuses an empty update', async () => {
    stubRoute({ expectedVersion: 2 }, ['READ', 'WRITE'])
    await expect((await route())({})).rejects.toBeTruthy()
  })
})

describe('POST /api/v1/articles/generate', () => {
  it('queues the request after the capacity check and points to its status', async () => {
    const calls = stubRoute({ topic: 'How to winter-proof a garden pond' }, ['READ', 'GENERATE'])
    const capacity = vi.fn().mockResolvedValue(undefined)
    const created = {
      id: 'gen-1',
      topic: 'How to winter-proof a garden pond',
      status: 'QUEUED',
      articleId: null,
      error: null,
      createdAt: new Date('2026-11-04T10:00:00Z'),
      startedAt: null,
      finishedAt: null,
    }
    const create = vi.fn().mockResolvedValue(created)
    let required: unknown
    vi.stubGlobal('withIdempotency', (_e: unknown, _k: unknown, _b: unknown, run: () => unknown, opts: unknown) => {
      required = opts
      return run()
    })
    vi.stubGlobal('assertApiGenerationCapacity', capacity)
    vi.stubGlobal('prisma', { apiGeneration: { create } })
    vi.stubGlobal('API_GENERATION_VIEW', generations.API_GENERATION_VIEW)
    vi.stubGlobal('serializeApiGeneration', generations.serializeApiGeneration)

    const route = (await import('../../server/api/v1/articles/generate.post')).default as (e: unknown) => unknown
    await expect(route({})).resolves.toEqual({
      data: expect.objectContaining({ id: 'gen-1', status: 'queued', createdAt: '2026-11-04T10:00:00.000Z' }),
    })
    expect(required).toEqual({ required: true })
    expect(calls.requireTenantScope).toHaveBeenCalledWith({}, 'AI_USE')
    expect(capacity).toHaveBeenCalledWith('site-1')
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clientSiteId: 'site-1', apiKeyId: 'key-1' }) }),
    )
    expect(calls.setResponseHeader).toHaveBeenCalledWith({}, 'Location', '/api/v1/generations/gen-1')
  })
})

describe('generation capacity', () => {
  const stub = ({ plan = 'PRO', pending = 0, queued = 0, available = 10 } = {}) => {
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('hasAiPlan', (value: string) => value !== 'BASIC')
    vi.stubGlobal('articleQualityOf', () => 'STANDARD')
    vi.stubGlobal('articleCreditCost', () => 1)
    vi.stubGlobal('getArticleCreditWallet', async () => ({ available }))
    vi.stubGlobal('prisma', {
      clientSite: { findUniqueOrThrow: async () => ({ plan, articleQuality: 'STANDARD' }) },
      apiGeneration: {
        count: async ({ where }: { where: { status: unknown } }) =>
          typeof where.status === 'string' ? queued : pending,
      },
    })
  }

  it('accepts a request the wallet can pay for', async () => {
    stub()
    await expect(generations.assertApiGenerationCapacity('site-1')).resolves.toBeUndefined()
  })

  it('refuses without an AI plan', async () => {
    stub({ plan: 'BASIC' })
    await expect(generations.assertApiGenerationCapacity('site-1')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('caps the queue per site', async () => {
    stub({ pending: generations.MAX_PENDING_API_GENERATIONS })
    await expect(generations.assertApiGenerationCapacity('site-1')).rejects.toMatchObject({ statusCode: 429 })
  })

  it('counts queued requests as already spent', async () => {
    stub({ pending: 2, queued: 2, available: 2 })
    await expect(generations.assertApiGenerationCapacity('site-1')).rejects.toMatchObject({
      statusCode: 402,
      data: { required: 3, available: 2 },
    })
  })
})

describe('queued generation authorization', () => {
  const setup = (row: unknown, scopes = ['AI_USE', 'ARTICLE_WRITE']) => {
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('prisma', { apiKey: { findFirst: vi.fn().mockResolvedValue(row) } })
    vi.stubGlobal('apiKeyCreatorAccess', vi.fn().mockResolvedValue({ scopes }))
  }
  const row = { ...key(['WRITE', 'GENERATE']), clientSite: { plan: 'PRO' } }

  it('requires a still-active key and current creator permissions', async () => {
    setup(row)
    await expect(generations.requireApiGenerationAccess('key-1', 'site-1')).resolves.toBeUndefined()
    expect(prisma.apiKey.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ clientSiteId: 'site-1', revokedAt: null }) }),
    )
  })

  it.each([null, { ...row, scopes: ['READ'] }])('rejects revoked or narrowed keys', async (value) => {
    setup(value)
    await expect(generations.requireApiGenerationAccess('key-1', 'site-1')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('rejects a creator whose current scopes no longer permit generation', async () => {
    setup(row, ['AI_USE'])
    await expect(generations.requireApiGenerationAccess('key-1', 'site-1')).rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('publish scope rules', () => {
  it('lets a draft be created or edited with WRITE alone', () => {
    expect(v1.requiresPublishScope({ status: 'draft' }, false)).toBe(false)
    expect(v1.requiresPublishScope({}, true)).toBe(false)
  })

  it('treats publishing, unpublishing and scheduling as PUBLISH', () => {
    expect(v1.requiresPublishScope({ status: 'published' }, false)).toBe(true)
    expect(v1.requiresPublishScope({ releaseAt: '2026-12-01T10:00:00Z' }, false)).toBe(true)
    expect(v1.requiresPublishScope({ status: 'draft' }, true)).toBe(true)
    expect(v1.requiresPublishScope({ releaseAt: null }, true)).toBe(true)
  })
})

import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../server/utils/articleViewerAccess'), 'publicArticleWhere')
}

await stubImports()

const { externalArticleWhere, flattenExternalArticle, parseExternalTagFilter, requireExternalClient } =
  await import('../../server/utils/externalApi')
const { hashApiKey, requireApiKey } = await import('../../server/utils/apiKeys')

describe('external API authentication', () => {
  afterEach(() => vi.unstubAllGlobals())

  const setup = (headers: Record<string, string | undefined> = {}, key: object | null = {}) => {
    const getHeader = vi.fn((_event: unknown, name: string) => ({ 'x-api-key': 'tenant-key', ...headers })[name])
    const findUnique = vi.fn().mockResolvedValue(
      key && {
        id: 'key-1',
        scopes: ['READ'],
        createdById: null,
        revokedAt: null,
        deletedAt: null,
        lastUsedAt: new Date(),
        clientSite: { id: 'tenant-1', plan: 'BASIC', deletedAt: null },
        ...key,
      },
    )
    vi.stubGlobal('setResponseHeader', vi.fn())
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('getHeader', getHeader)
    vi.stubGlobal('consumeRateLimit', vi.fn().mockResolvedValue(true))
    vi.stubGlobal('prisma', { apiKey: { findUnique } })
    vi.stubGlobal('requireApiKey', requireApiKey)
    return { run: () => requireExternalClient({ context: {} } as never), getHeader, findUnique }
  }

  it.each([undefined, 'Topiqu-Sync/1.0.0', 'External-Sync/1.0'])(
    'authenticates API consumers equally (user agent: %s)',
    async (userAgent) => {
      const { run, getHeader, findUnique } = setup({ 'user-agent': userAgent })
      await expect(run()).resolves.toEqual({ id: 'tenant-1' })
      expect(getHeader).toHaveBeenCalledOnce()
      expect(getHeader).toHaveBeenCalledWith(expect.anything(), 'x-api-key')
      expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { hash: hashApiKey('tenant-key') } }))
    },
  )

  it('still rejects missing API keys before querying the tenant', async () => {
    const { run, findUnique } = setup({ 'x-api-key': undefined })
    await expect(run()).rejects.toMatchObject({ statusCode: 401 })
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('still rejects invalid API keys', async () => {
    const { run } = setup({}, null)
    await expect(run()).rejects.toMatchObject({ statusCode: 401 })
  })

  it('accepts migrated read-only keys on read routes', async () => {
    const { run } = setup({}, { scopes: ['READ'], createdById: null })
    await expect(run()).resolves.toEqual({ id: 'tenant-1' })
  })
})

describe('external API helpers', () => {
  it('normalizes and deduplicates comma-separated tag filters', () => {
    expect(parseExternalTagFilter(' seo,news,seo, , product ')).toEqual(['seo', 'news', 'product'])
    expect(parseExternalTagFilter(['seo'])).toEqual([])
  })

  it('builds an AND filter scoped to published tenant articles', () => {
    const now = new Date('2026-10-22T12:00:00Z')
    expect(externalArticleWhere('site-1', ['seo', 'news'], now)).toEqual({
      clientSiteId: 'site-1',
      status: 'published',
      deletedAt: null,
      clientSite: { deletedAt: null },
      OR: [{ releaseAt: null }, { releaseAt: { lte: now } }],
      AND: [{ tags: { some: { tag: { slug: 'seo' } } } }, { tags: { some: { tag: { slug: 'news' } } } }],
    })
  })

  it('flattens relation wrappers for new detail responses', () => {
    const result = flattenExternalArticle(
      {
        id: 'article-1',
        tags: [{ tag: { id: 'tag-1', name: 'SEO', slug: 'seo' } }],
        translations: [{ language: 'en', slug: 'hello' }],
      },
      'cs',
    )

    expect(result).toMatchObject({
      id: 'article-1',
      language: 'cs',
      tags: [{ id: 'tag-1', name: 'SEO', slug: 'seo' }],
      availableTranslations: [{ language: 'en', slug: 'hello' }],
    })
    expect(result).not.toHaveProperty('translations')
  })
})

describe('external article source identity', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('returns the authenticated tenant identity with every article page', async () => {
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('getQuery', () => ({}))
    vi.stubGlobal('getPagination', async () => ({ skip: 0, take: 100 }))
    vi.stubGlobal('requireExternalClient', async () => ({ id: 'tenant-page-owner', language: 'cs' }))
    vi.stubGlobal('parseExternalTagFilter', parseExternalTagFilter)
    vi.stubGlobal('externalArticleWhere', externalArticleWhere)
    vi.stubGlobal('prisma', {
      article: { count: async () => 0, findMany: async () => [] },
      $transaction: async (work: Promise<unknown>[]) => Promise.all(work),
    })
    const route = (await import('../../server/api/external/articles.get')).default
    await expect(route({} as never)).resolves.toMatchObject({ meta: { siteId: 'tenant-page-owner' } })
  })
})

beforeEach(stubImports)

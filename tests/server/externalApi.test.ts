import { createError } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  externalArticleWhere,
  flattenExternalArticle,
  parseExternalTagFilter,
  requireExternalClient,
} from '../../server/utils/externalApi'

describe('external API authentication', () => {
  afterEach(() => vi.unstubAllGlobals())

  const setup = (
    headers: Record<string, string | undefined> = {},
    client: { id: string } | null = { id: 'tenant-1' },
  ) => {
    const getHeader = vi.fn((_event: unknown, name: string) => ({ 'x-api-key': 'tenant-key', ...headers })[name])
    const findFirst = vi.fn().mockResolvedValue(client)
    vi.stubGlobal('setResponseHeader', vi.fn())
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('getHeader', getHeader)
    vi.stubGlobal('prisma', { clientSite: { findFirst } })
    return { run: () => requireExternalClient({} as never), getHeader, findFirst }
  }

  it.each([undefined, 'Topiqu-Sync/1.0.0', 'External-Sync/1.0'])(
    'authenticates API consumers equally (user agent: %s)',
    async (userAgent) => {
      const { run, getHeader, findFirst } = setup({ 'user-agent': userAgent })
      await expect(run()).resolves.toEqual({ id: 'tenant-1' })
      expect(getHeader).toHaveBeenCalledOnce()
      expect(getHeader).toHaveBeenCalledWith({}, 'x-api-key')
      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { apiKey: 'tenant-key', deletedAt: null } }),
      )
    },
  )

  it('still rejects missing API keys before querying the tenant', async () => {
    const { run, findFirst } = setup({ 'x-api-key': undefined })
    await expect(run()).rejects.toMatchObject({ statusCode: 401 })
    expect(findFirst).not.toHaveBeenCalled()
  })

  it('still rejects invalid API keys', async () => {
    const { run } = setup({}, null)
    await expect(run()).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('external API helpers', () => {
  it('normalizes and deduplicates comma-separated tag filters', () => {
    expect(parseExternalTagFilter(' seo,news,seo, , product ')).toEqual(['seo', 'news', 'product'])
    expect(parseExternalTagFilter(['seo'])).toEqual([])
  })

  it('builds an AND filter scoped to published tenant articles', () => {
    expect(externalArticleWhere('site-1', ['seo', 'news'])).toEqual({
      clientSiteId: 'site-1',
      status: 'published',
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

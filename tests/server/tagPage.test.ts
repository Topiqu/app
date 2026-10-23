import { createError, getRouterParam } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllGlobals())

const setup = async (matches: Array<{ id: string; name: string; slug: string; articles: never[] } | null>) => {
  const findFirst = vi.fn()
  matches.forEach((match) => findFirst.mockResolvedValueOnce(match))
  const db = {
    clientSite: { findUnique: vi.fn().mockResolvedValue({ id: 'tenant-1' }) },
    tag: { findFirst },
    article: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
  }
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getSessionUser', async () => null)
  vi.stubGlobal('getEnhancedPrisma', async () => db)
  vi.stubGlobal('getRouterParam', getRouterParam)
  vi.stubGlobal('getPagination', async () => ({ skip: 0, take: 20 }))
  vi.stubGlobal('getQuery', () => ({ site: 'tenant' }))
  const handler = (await import('../../server/api/tags/slug/[slug]')).default
  return { run: () => handler({ context: { params: { slug: 'mu%20j' } } } as never), findFirst, articles: db.article }
}

describe('public tag lookup', () => {
  const tag = { id: 'tag-1', name: 'mu j', slug: 'mu-j', articles: [] as never[] }

  it('prefers the exact slug and always confines the lookup to the publication', async () => {
    const { run, findFirst } = await setup([tag])
    expect(await run()).toMatchObject({ id: tag.id, slug: tag.slug })
    expect(findFirst).toHaveBeenCalledTimes(1)
    expect(findFirst.mock.calls[0]![0].where).toEqual({ slug: 'mu j', clientSiteId: 'tenant-1' })
  })

  it('resolves old name-based links to the stored canonical slug', async () => {
    const { run, findFirst } = await setup([null, tag])
    expect(await run()).toMatchObject({ slug: 'mu-j' })
    expect(findFirst.mock.calls[1]![0].where).toEqual({ name: 'mu j', clientSiteId: 'tenant-1' })
  })

  it('returns a translated not-found error for an unknown tag', async () => {
    const { run } = await setup([null, null])
    await expect(run()).rejects.toMatchObject({ statusCode: 404, message: 'common.errors.tagNotFound' })
  })

  it('queries visible article roots before pagination and uses the same tenant filter for totals', async () => {
    const { run, articles } = await setup([tag])
    await run()
    const query = articles.findMany.mock.calls[0]![0]
    expect(query.where).toEqual({
      clientSiteId: 'tenant-1',
      tags: { some: { tagId: tag.id } },
      status: 'published',
      deletedAt: null,
      clientSite: { deletedAt: null },
      OR: [{ releaseAt: null }, { releaseAt: { lte: expect.any(Date) } }],
    })
    expect(query).toMatchObject({ take: 21, skip: 0 })
    expect(query.select).not.toHaveProperty('content')
    expect(articles.count).toHaveBeenCalledWith({ where: query.where })
  })
})

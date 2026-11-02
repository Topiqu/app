import { z } from 'zod'
import { createError } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

const setup = async (body: unknown = { name: ' Česká série ', articleIds: ['b', 'a'] }) => {
  const findFirst = vi.fn().mockResolvedValue(null)
  const findSlugs = vi.fn().mockResolvedValue([])
  const findArticles = vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }])
  const create = vi
    .fn()
    .mockResolvedValue({ id: 'series', name: 'Česká série', slug: 'ceska-serie', createdByAi: false })
  const updateMany = vi.fn().mockResolvedValue({ count: 1 })
  const tx = { articleSeries: { findMany: findSlugs, create }, article: { findMany: findArticles, updateMany } }
  const transaction = vi.fn(async (callback: (db: typeof tx) => unknown) => callback(tx))
  const db = vi.fn().mockResolvedValue({ articleSeries: { findFirst }, $transaction: transaction })
  const scope = vi.fn().mockResolvedValue({
    user: { id: 'writer', clientSiteId: 'site' },
    membership: { clientSiteId: 'site' },
  })
  const canEditOthers = vi.fn().mockReturnValue(false)
  const invalidateFeed = vi.fn()
  const logAction = vi.fn()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('requireTenantScope', scope)
  vi.stubGlobal('hasTenantScope', canEditOthers)
  vi.stubGlobal('getEnhancedPrisma', db)
  vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (input: unknown) => unknown) => parse(body))
  vi.stubGlobal('invalidateFeed', invalidateFeed)
  vi.stubGlobal('logAction', logAction)
  vi.stubGlobal('getIp', () => '127.0.0.1')
  const { default: handler } = await import('../../server/api/series/index.post')
  return {
    run: () => handler({} as never),
    scope,
    db,
    canEditOthers,
    findFirst,
    findSlugs,
    findArticles,
    create,
    updateMany,
    transaction,
    invalidateFeed,
    logAction,
  }
}

describe('manual series creation', () => {
  it('requires article-write access before using the enhanced database', async () => {
    const state = await setup()
    state.scope.mockRejectedValue(createError({ statusCode: 403 }))
    await expect(state.run()).rejects.toMatchObject({ statusCode: 403 })
    expect(state.scope).toHaveBeenCalledWith(expect.anything(), 'ARTICLE_WRITE')
    expect(state.db).not.toHaveBeenCalled()
  })

  it.each([
    { name: '' },
    { name: 1 },
    { name: 'a'.repeat(256) },
    { name: 'Series', description: 'a'.repeat(501) },
    { name: 'Series', articleIds: [''] },
    { name: 'Series', articleIds: Array.from({ length: 101 }, (_, index) => `${index}`) },
  ])('validates the request before starting a transaction: %j', async (body) => {
    const state = await setup(body)
    await expect(state.run()).rejects.toBeInstanceOf(z.ZodError)
    expect(state.transaction).not.toHaveBeenCalled()
  })

  it('creates and assigns parts in selection order, scoped to the tenant and editable author', async () => {
    const state = await setup()
    const result = await state.run()
    expect(state.findArticles).toHaveBeenCalledWith({
      where: { id: { in: ['b', 'a'] }, clientSiteId: 'site', deletedAt: null, articleSeriesId: null, userId: 'writer' },
      select: { id: true },
    })
    expect(state.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: 'Česká série', slug: 'ceska-serie', description: null, clientSiteId: 'site' },
      }),
    )
    expect(state.updateMany.mock.calls.map(([args]) => [args.where.id, args.data.seriesOrder])).toEqual([
      ['b', 1],
      ['a', 2],
    ])
    expect(state.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'b', clientSiteId: 'site', deletedAt: null, articleSeriesId: null, userId: 'writer' },
        data: { articleSeriesId: 'series', seriesOrder: 1 },
      }),
    )
    expect(result.articles).toEqual([{ id: 'b' }, { id: 'a' }])
    expect(state.transaction).toHaveBeenCalledOnce()
    expect(state.invalidateFeed).toHaveBeenCalledWith('site')
    expect(state.logAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'ARTICLE_SERIES_CREATE' }))
  })

  it('allows members with write-others scope to select other authors in the active tenant', async () => {
    const state = await setup()
    state.canEditOthers.mockReturnValue(true)
    await state.run()
    expect(state.findArticles.mock.calls[0]![0].where).not.toHaveProperty('userId')
    expect(state.findArticles.mock.calls[0]![0].where.clientSiteId).toBe('site')
  })

  it('rejects unavailable, deleted, foreign-tenant or unauthorized IDs without creating anything', async () => {
    const state = await setup()
    state.findArticles.mockResolvedValue([{ id: 'a' }])
    await expect(state.run()).rejects.toMatchObject({ statusCode: 409, message: 'series.articlesUnavailable' })
    expect(state.create).not.toHaveBeenCalled()
    expect(state.updateMany).not.toHaveBeenCalled()
  })

  it('throws inside the transaction on a concurrent assignment and does not report success', async () => {
    const state = await setup()
    state.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 })
    await expect(state.run()).rejects.toMatchObject({ statusCode: 409 })
    expect(state.invalidateFeed).not.toHaveBeenCalled()
    expect(state.logAction).not.toHaveBeenCalled()
  })

  it('keeps creation without articles compatible with the editor selector', async () => {
    const state = await setup({ name: 'Series', description: ' Short description ' })
    await expect(state.run()).resolves.toMatchObject({ articles: [] })
    expect(state.findArticles).not.toHaveBeenCalled()
    expect(state.updateMany).not.toHaveBeenCalled()
    expect(state.create.mock.calls[0]![0].data.description).toBe('Short description')
  })

  it('deduplicates IDs while retaining their order', async () => {
    const state = await setup({ name: 'Series', articleIds: ['b', 'a', 'b'] })
    await state.run()
    expect(state.updateMany).toHaveBeenCalledTimes(2)
  })

  it('rejects duplicate names before writing and finds a free slug for different names', async () => {
    const state = await setup()
    state.findFirst.mockResolvedValueOnce({ id: 'existing' })
    await expect(state.run()).rejects.toMatchObject({ statusCode: 409, message: 'series.duplicateName' })
    expect(state.transaction).not.toHaveBeenCalled()
    state.findSlugs.mockResolvedValue([{ slug: 'ceska-serie' }, { slug: 'ceska-serie-2' }])
    await state.run()
    expect(state.create.mock.calls[0]![0].data.slug).toBe('ceska-serie-3')
  })
})

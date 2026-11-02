import { createError } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

const setup = async () => {
  const findMany = vi.fn().mockResolvedValue([
    { id: 'scheduled', status: 'draft', releaseAt: new Date('2099-01-01') },
    { id: 'draft', status: 'draft', releaseAt: null },
  ])
  const count = vi.fn().mockResolvedValue(22)
  const db = vi.fn().mockResolvedValue({ article: { findMany, count } })
  const scope = vi.fn().mockResolvedValue({ user: { id: 'writer' }, membership: { clientSiteId: 'site' } })
  const canEditOthers = vi.fn().mockReturnValue(false)
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('requireTenantScope', scope)
  vi.stubGlobal('hasTenantScope', canEditOthers)
  vi.stubGlobal('getEnhancedPrisma', db)
  vi.stubGlobal('getPagination', async () => ({ skip: 10, take: 10 }))
  vi.stubGlobal('getValidatedQuery', async (_event: unknown, parse: (value: unknown) => unknown) =>
    parse({ query: 'Český' }),
  )
  const { default: handler } = await import('../../server/api/series/articles.get')
  return { run: () => handler({} as never), findMany, count, db, scope, canEditOthers }
}

describe('series article picker endpoint', () => {
  it('requires write access before querying articles', async () => {
    const state = await setup()
    state.scope.mockRejectedValue(createError({ statusCode: 403 }))
    await expect(state.run()).rejects.toMatchObject({ statusCode: 403 })
    expect(state.db).not.toHaveBeenCalled()
  })

  it('paginates title search with explicit selection, standalone, tenant and author restrictions', async () => {
    const state = await setup()
    const result = await state.run()
    const where = {
      clientSiteId: 'site',
      deletedAt: null,
      articleSeriesId: null,
      userId: 'writer',
      title: { contains: 'Český', mode: 'insensitive' },
    }
    expect(state.findMany).toHaveBeenCalledWith({
      where,
      select: { id: true, title: true, imageUrl: true, language: true, status: true, releaseAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: 10,
      take: 10,
    })
    expect(state.count).toHaveBeenCalledWith({ where })
    expect(result.total).toBe(22)
    expect(result.data.map(({ scheduled }) => scheduled)).toEqual([true, false])
  })

  it('retains tenant isolation when the member can edit other authors', async () => {
    const state = await setup()
    state.canEditOthers.mockReturnValue(true)
    await state.run()
    expect(state.findMany.mock.calls[0]![0].where).not.toHaveProperty('userId')
    expect(state.findMany.mock.calls[0]![0].where.clientSiteId).toBe('site')
  })
})

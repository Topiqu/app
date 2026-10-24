import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

const setup = async (allowed: boolean) => {
  const findMany = vi.fn().mockResolvedValue([
    {
      id: 'series',
      name: 'Series',
      articles: [
        { id: 'live', status: 'published', releaseAt: null },
        { id: 'draft', status: 'draft', releaseAt: null },
        { id: 'future', status: 'published', releaseAt: new Date('2099-01-01') },
      ],
    },
  ])
  const db = vi.fn().mockResolvedValue({ articleSeries: { findMany } })
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal(
    'requireTenantScope',
    vi.fn(async () => {
      if (!allowed) throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
      return { user: { id: 'writer', clientSiteId: 'site-1' } }
    }),
  )
  vi.stubGlobal('getEnhancedPrisma', db)
  return {
    run: () => import('../../server/api/series/index.get').then(({ default: handler }) => handler({} as never)),
    findMany,
    db,
  }
}

it('checks article-write permission before reading administrative series details', async () => {
  const state = await setup(false)
  await expect(state.run()).rejects.toMatchObject({ statusCode: 403 })
  expect(state.db).not.toHaveBeenCalled()
})

it('scopes the overview to the active tenant and distinguishes scheduled parts from available parts', async () => {
  const state = await setup(true)
  const result = await state.run()
  expect(state.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { clientSiteId: 'site-1', deletedAt: null } }),
  )
  expect(result[0]?.articles.map((article) => [article.id, article.available])).toEqual([
    ['live', true],
    ['draft', false],
    ['future', false],
  ])
})

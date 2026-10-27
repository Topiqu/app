import { createError } from 'h3'
import { afterEach, expect, it, vi, beforeEach } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/articleViewerAccess'), 'canReadArticle')
}

await stubImports()

const { hasArticleAdminAccess, isArticleLive, sessionTenantId } = await import('../../../server/utils/articleViewerAccess')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

const setup = async (
  options: { deleted?: boolean; future?: boolean; tenantDeleted?: boolean; admin?: boolean; redirect?: boolean } = {},
) => {
  const article = {
    id: 'a1',
    clientSiteId: 's1',
    slug: 'article',
    language: 'en',
    status: 'published',
    deletedAt: options.deleted ? new Date() : null,
    releaseAt: options.future ? new Date('2099-01-01') : null,
    content: '<p>Public article</p>',
    reactions: [],
    _count: { comments: 0, reactions: 0 },
    articleSeriesId: null,
    seriesOrder: null,
    user: null,
    clientSite: {
      deletedAt: options.tenantDeleted ? new Date() : null,
      domain: 'example.test',
      commentsEnabled: true,
      commentGifsEnabled: true,
    },
  }
  const links = vi.fn(async (_db: unknown, content: string) => content)
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getSessionUser', async () => (options.admin ? { id: 'u1', role: 'admin', clientSiteId: 's1' } : null))
  vi.stubGlobal('getRouterParam', () => 'article')
  vi.stubGlobal('getQuery', () => ({ clientSiteId: 's1' }))
  vi.stubGlobal('readAnonSession', () => null)
  vi.stubGlobal('sessionTenantId', sessionTenantId)
  vi.stubGlobal('hasArticleAdminAccess', hasArticleAdminAccess)
  vi.stubGlobal('isArticleLive', isArticleLive)
  vi.stubGlobal('resolveArticleLinks', links)
  vi.stubGlobal('articleBlocks', () => ({}))
  vi.stubGlobal('prisma', {
    article: {
      findUnique: vi.fn().mockResolvedValue(options.redirect ? null : article),
      findFirst: vi.fn().mockResolvedValue(article),
    },
    articleTranslation: { findMany: vi.fn().mockResolvedValue([]) },
    articleSlugRedirect: { findUnique: vi.fn().mockResolvedValue(options.redirect ? { article } : null) },
  })
  const handler = (await import('../../../server/api/articles/[id]/index.get')).default
  return { run: () => handler({} as never), links }
}

it.each([{ deleted: true }, { future: true }, { tenantDeleted: true }])(
  'does not serve unavailable public content: %j',
  async (options) => {
    const { run, links } = await setup(options)
    await expect(run()).rejects.toMatchObject({ statusCode: 404 })
    expect(links).not.toHaveBeenCalled()
  },
)

it('keeps the internal visibility marker out of the public payload', async () => {
  const { run } = await setup()
  const result = await run()
  expect(result.id).toBe('a1')
  expect(result).not.toHaveProperty('deletedAt')
})

it('preserves administrative scheduled preview', async () => {
  const { run } = await setup({ future: true, admin: true })
  await expect(run()).resolves.toMatchObject({ id: 'a1' })
})

it('keeps an old public slug redirecting to the visible current slug', async () => {
  const { run } = await setup({ redirect: true })
  await expect(run()).rejects.toMatchObject({ statusCode: 404, data: { movedTo: 'article' } })
})

it.each([{ deleted: true }, { future: true }, { tenantDeleted: true }])(
  'does not disclose an unavailable redirect target: %j',
  async (options) => {
    const { run } = await setup({ ...options, redirect: true })
    await expect(run()).rejects.toMatchObject({ statusCode: 404, data: undefined })
  },
)

beforeEach(stubImports)

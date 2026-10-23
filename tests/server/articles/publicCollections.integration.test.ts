// @vitest-environment node
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { PolicyPlugin } from '@zenstackhq/plugin-policy'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { tenantByHost } from '../../../server/utils/tenant'
import { articleExcerpt } from '../../../shared/utils/articleBlocks'
import { createDatabaseClient } from '../../../server/utils/database'
import { localizeArticles } from '../../../server/utils/articleLocale'
import { articleModifiedAt } from '../../../server/utils/articleModified'
import { resolveArticleBySlug } from '../../../server/utils/articleBySlug'
import { hasArticleAdminAccess } from '../../../server/utils/articleViewerAccess'
import {
  externalArticleDetailV1Select,
  externalArticleSummaryV1Select,
  serializeExternalArticleV1,
} from '../../../server/utils/externalApiV1'
import {
  externalArticleSelect,
  externalArticleWhere,
  flattenExternalArticle,
  parseExternalTagFilter,
  requireExternalClient,
} from '../../../server/utils/externalApi'

// Nuxt's Vite transform imports this composable directly; a global stub alone cannot replace it.
mockNuxtImport('useRuntimeConfig', () => () => ({ public: { baseDomain: 'platform.invalid' } }))

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url) : null
const sites: string[] = []
const users: string[] = []
afterEach(() => vi.unstubAllGlobals())
afterAll(async () => {
  if (!db) return
  await db.clientSite.deleteMany({ where: { id: { in: sites } } })
  await db.user.deleteMany({ where: { id: { in: users } } })
  await db.$disconnect()
})

const routes = {
  rss: () => import('../../../server/routes/rss.xml.get'),
  sitemap: () => import('../../../server/api/__sitemap__/urls.get'),
  llms: () => import('../../../server/routes/llms.txt.get'),
  markdown: () => import('../../../server/routes/md/[...path].get'),
  author: () => import('../../../server/api/articles/[id]/by-author'),
  authorStats: () => import('../../../server/api/users/[id]/author.get'),
  tag: () => import('../../../server/api/tags/slug/[slug]'),
  externalList: () => import('../../../server/api/external/articles.get'),
  externalDetail: () => import('../../../server/api/external/articles/[id].get'),
  externalSite: () => import('../../../server/api/external/site.get'),
  externalTags: () => import('../../../server/api/external/tags.get'),
  v1List: () => import('../../../server/api/v1/articles.get'),
  v1Detail: () => import('../../../server/api/v1/articles/[id].get'),
}

const fixture = async () => {
  const clientSiteId = randomUUID()
  const foreignSiteId = randomUUID()
  const deletedSiteId = randomUUID()
  const userId = randomUUID()
  const apiKey = randomUUID()
  sites.push(clientSiteId, foreignSiteId, deletedSiteId)
  users.push(userId)
  for (const id of [clientSiteId, foreignSiteId, deletedSiteId])
    await db!.clientSite.create({
      data: {
        id,
        name: `collections-${id}`,
        domain: `${id}.invalid`,
        domainVerified: true,
        language: 'cs',
        plan: 'PRO',
        ...(id === clientSiteId ? { apiKey } : {}),
        ...(id === deletedSiteId ? { deletedAt: new Date() } : {}),
      },
    })
  const user = await db!.user.create({
    data: { id: userId, email: `${userId}@example.invalid`, username: userId, role: 'admin', clientSiteId },
  })
  const visibleTag = await db!.tag.create({ data: { clientSiteId, slug: 'visible-tag', name: 'Visible tag' } })
  const hiddenTag = await db!.tag.create({ data: { clientSiteId, slug: 'hidden-tag', name: 'Hidden tag' } })
  const create = async (kind: 'visible' | 'future' | 'deleted' | 'draft' | 'foreign' | 'deletedTenant') => {
    const row = await db!.article.create({
      data: {
        clientSiteId: kind === 'foreign' ? foreignSiteId : kind === 'deletedTenant' ? deletedSiteId : clientSiteId,
        userId,
        slug: `${kind}-${randomUUID()}`,
        title: `${kind} source title`,
        content: `<p>${kind} source body</p>`,
        excerpt: `${kind} excerpt`,
        language: kind === 'future' ? 'de' : kind === 'deleted' ? 'fr' : 'cs',
        status: kind === 'draft' ? 'draft' : 'published',
        publishedAt: new Date('2026-01-01'),
        views: kind === 'visible' ? 10 : 100,
        releaseAt: kind === 'future' ? new Date('2099-01-01') : null,
        deletedAt: kind === 'deleted' ? new Date() : null,
      },
    })
    if (row.clientSiteId === clientSiteId) {
      await db!.articleTag.create({ data: { articleId: row.id, tagId: visibleTag.id } })
      if (kind !== 'visible') await db!.articleTag.create({ data: { articleId: row.id, tagId: hiddenTag.id } })
    }
    await db!.articleReaction.create({ data: { articleId: row.id, userId } })
    return row
  }
  const visible = await create('visible')
  const future = await create('future')
  const deleted = await create('deleted')
  const draft = await create('draft')
  const foreign = await create('foreign')
  const deletedTenant = await create('deletedTenant')
  const translated = async (article: typeof visible, language: 'en' | 'de' | 'fr') => {
    const slug = `translation-${randomUUID()}`
    await db!.articleTranslation.create({
      data: {
        articleId: article.id,
        clientSiteId: article.clientSiteId,
        language,
        status: 'PUBLISHED',
        slug,
        title: `${article.title} translation`,
        content: `${article.content} translation`,
      },
    })
    return slug
  }
  const visibleTranslation = await translated(visible, 'en')
  const futureTranslation = await translated(future, 'fr')
  const deletedTranslation = await translated(deleted, 'de')
  const draftTranslation = await translated(draft, 'de')
  const links = vi.fn(async (_database: unknown, content: string) => content)
  const run = async (
    kind: keyof typeof routes,
    options: { article?: typeof visible; translatedSlug?: string; language?: string; owner?: boolean } = {},
  ): Promise<unknown> => {
    const viewer = options.owner ? { id: userId, role: 'admin' as const, clientSiteId } : null
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('defineSitemapEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('getSessionUser', async () => viewer)
    vi.stubGlobal('getEnhancedPrisma', async () => db!.$use(new PolicyPlugin()).$setAuth(viewer ?? undefined))
    vi.stubGlobal('requireTenantMember', async () => ({
      membership: { role: 'OWNER', scopes: ['ARTICLE_WRITE', 'ARTICLE_WRITE_OTHERS'] },
    }))
    vi.stubGlobal('hasTenantScope', () => true)
    vi.stubGlobal('readAnonSession', () => null)
    vi.stubGlobal('getPagination', async () => ({ take: 20, skip: 0 }))
    vi.stubGlobal('getQuery', () => ({ site: `collections-${clientSiteId}` }))
    const article = options.article ?? visible
    const path = `${options.language ?? 'cs'}/${options.language === 'en' ? 'articles' : options.language === 'de' ? 'artikel' : options.language === 'fr' ? 'articles' : 'clanky'}/${options.translatedSlug ?? article.slug}`
    vi.stubGlobal('getRouterParam', () =>
      kind === 'markdown' ? path : kind === 'author' ? user.username : kind === 'tag' ? visibleTag.slug : article.id,
    )
    vi.stubGlobal('getRouterParams', () => ({ id: userId }))
    vi.stubGlobal('getRequestHost', () => `${clientSiteId}.invalid`)
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { baseDomain: 'platform.invalid' } }))
    vi.stubGlobal('tenantByHost', tenantByHost)
    vi.stubGlobal('requestOrigin', () => `https://${clientSiteId}.invalid`)
    vi.stubGlobal('articleModifiedAt', articleModifiedAt)
    vi.stubGlobal('articleExcerpt', articleExcerpt)
    vi.stubGlobal('resolveArticleLinks', links)
    vi.stubGlobal('contentToMarkdown', (content: string) => content)
    vi.stubGlobal('hasArticleAdminAccess', hasArticleAdminAccess)
    vi.stubGlobal('resolveArticleBySlug', resolveArticleBySlug)
    vi.stubGlobal('localizeArticles', localizeArticles)
    vi.stubGlobal('cachedAuthor', async (_id: string, load: () => Promise<unknown>) => load())
    vi.stubGlobal('setHeader', vi.fn())
    vi.stubGlobal('setResponseHeader', vi.fn())
    vi.stubGlobal('getHeader', () => apiKey)
    vi.stubGlobal('requireExternalClient', requireExternalClient)
    vi.stubGlobal('parseExternalTagFilter', parseExternalTagFilter)
    vi.stubGlobal('externalArticleWhere', externalArticleWhere)
    vi.stubGlobal('externalArticleSelect', externalArticleSelect)
    vi.stubGlobal('flattenExternalArticle', flattenExternalArticle)
    vi.stubGlobal('externalArticleDetailV1Select', externalArticleDetailV1Select)
    vi.stubGlobal('externalArticleSummaryV1Select', externalArticleSummaryV1Select)
    vi.stubGlobal('serializeExternalArticleV1', serializeExternalArticleV1)
    vi.stubGlobal('prisma', db)
    const route = (await routes[kind]()).default
    return route({ path: `/md/${path}` } as never)
  }
  return {
    clientSiteId,
    visible,
    future,
    deleted,
    draft,
    foreign,
    deletedTenant,
    visibleTranslation,
    futureTranslation,
    deletedTranslation,
    draftTranslation,
    visibleTag,
    hiddenTag,
    links,
    run,
  }
}

describe.skipIf(!enabled)('public article collection visibility on PostgreSQL', () => {
  it.each(['rss', 'sitemap', 'llms'] as const)(
    '%s excludes hidden sources and their published translations',
    async (kind) => {
      const data = await fixture()
      const text = JSON.stringify(await data.run(kind))
      expect(text).toContain(data.visible.slug)
      for (const row of [data.future, data.deleted, data.draft, data.foreign, data.deletedTenant])
        expect(text).not.toContain(row.slug)
      for (const slug of [data.futureTranslation, data.deletedTranslation, data.draftTranslation])
        expect(text).not.toContain(slug)
      if (kind !== 'rss') expect(text).toContain(data.visibleTranslation)
    },
  )

  it.each(['future', 'deleted', 'draft'] as const)(
    'Markdown denies a %s source before content rendering',
    async (kind) => {
      const data = await fixture()
      await expect(data.run('markdown', { article: data[kind], language: data[kind].language })).rejects.toMatchObject({
        statusCode: 404,
      })
      expect(data.links).not.toHaveBeenCalled()
    },
  )

  it.each(['future', 'deleted', 'draft'] as const)(
    'Markdown denies a published translation of a %s source',
    async (kind) => {
      const data = await fixture()
      const translatedSlug =
        kind === 'future'
          ? data.futureTranslation
          : kind === 'deleted'
            ? data.deletedTranslation
            : data.draftTranslation
      await expect(
        data.run('markdown', { translatedSlug, language: kind === 'future' ? 'fr' : 'de' }),
      ).rejects.toMatchObject({ statusCode: 404 })
    },
  )

  it('Markdown preserves visible original and translated access', async () => {
    const data = await fixture()
    expect(await data.run('markdown')).toContain(data.visible.title)
    expect(await data.run('markdown', { translatedSlug: data.visibleTranslation, language: 'en' })).toContain(
      data.visible.title,
    )
  })

  it('author cards and counts include only released content on undeleted publications', async () => {
    const data = await fixture()
    const result = await data.run('author')
    expect(result).toMatchObject({ total: 2, articleCount: 1, totalArticleViews: 10, totalArticleLikes: 1 })
    const text = JSON.stringify(result)
    expect(text).toContain(data.visible.id)
    expect(text).toContain(data.foreign.id)
    for (const row of [data.future, data.deleted, data.draft, data.deletedTenant]) expect(text).not.toContain(row.id)
  })

  it('cached public author statistics exclude scheduled sources', async () => {
    const data = await fixture()
    expect(await data.run('authorStats')).toMatchObject({
      articleCount: 1,
      totalArticleViews: 10,
      totalArticleLikes: 1,
    })
  })

  it('tag cards and pagination totals exclude scheduled and deleted sources', async () => {
    const data = await fixture()
    const result = await data.run('tag')
    expect(result).toMatchObject({ total: 1, hasMore: false })
    const text = JSON.stringify(result)
    expect(text).toContain(data.visible.id)
    for (const row of [data.future, data.deleted, data.draft]) expect(text).not.toContain(row.id)
  })

  it('tag pages preserve owner preview but always exclude deleted articles', async () => {
    const data = await fixture()
    const result = await data.run('tag', { owner: true })
    expect(result).toMatchObject({ total: 3 })
    const text = JSON.stringify(result)
    expect(text).toContain(data.future.id)
    expect(text).toContain(data.draft.id)
    expect(text).not.toContain(data.deleted.id)
  })

  it.each(['externalList', 'v1List'] as const)('%s exports only released undeleted source articles', async (kind) => {
    const data = await fixture()
    const result = await data.run(kind)
    expect(result).toMatchObject({ meta: { total: 1 } })
    const text = JSON.stringify(result)
    expect(text).toContain(data.visible.id)
    for (const row of [data.future, data.deleted, data.draft, data.foreign, data.deletedTenant])
      expect(text).not.toContain(row.id)
  })

  for (const route of ['externalDetail', 'v1Detail'] as const) {
    it.each(['future', 'deleted', 'draft'] as const)(`${route} denies a %s source`, async (kind) => {
      const data = await fixture()
      await expect(data.run(route, { article: data[kind] })).rejects.toMatchObject({ statusCode: 404 })
    })
  }

  it('external site languages/counts derive only from visible sources', async () => {
    const data = await fixture()
    expect(await data.run('externalSite')).toMatchObject({
      data: { articleCount: 1, availableLanguages: ['cs', 'en'] },
    })
  })

  it('external tags and article counts exclude hidden-only associations', async () => {
    const data = await fixture()
    const result = await data.run('externalTags')
    expect(result).toMatchObject({ data: [{ id: data.visibleTag.id, articleCount: 1 }], meta: { total: 1 } })
    expect(JSON.stringify(result)).not.toContain(data.hiddenTag.id)
  })

  it.each(['externalList', 'externalDetail', 'v1List', 'v1Detail'] as const)(
    '%s rejects a deleted tenant API key',
    async (kind) => {
      const data = await fixture()
      await db!.clientSite.update({ where: { id: data.clientSiteId }, data: { deletedAt: new Date() } })
      await expect(data.run(kind)).rejects.toMatchObject({ statusCode: 401 })
    },
  )
})

// @vitest-environment node
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { createDatabaseClient } from '../../../server/utils/database'
import { localizeArticles } from '../../../server/utils/articleLocale'
import { resolveArticleBySlug } from '../../../server/utils/articleBySlug'
import { hasArticleAdminAccess } from '../../../server/utils/articleViewerAccess'

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url) : null
const sites: string[] = []
const users: string[] = []
const tags: string[] = []
afterEach(() => vi.unstubAllGlobals())
afterAll(async () => {
  if (!db) return
  await db.clientSite.deleteMany({ where: { id: { in: sites } } })
  await db.tag.deleteMany({ where: { id: { in: tags } } })
  await db.user.deleteMany({ where: { id: { in: users } } })
  await db.$disconnect()
})

const fixture = async () => {
  const userId = randomUUID()
  const clientSiteId = randomUUID()
  const foreignSiteId = randomUUID()
  users.push(userId)
  sites.push(clientSiteId, foreignSiteId)
  await db!.user.create({ data: { id: userId, email: `${userId}@example.invalid`, username: userId } })
  for (const id of [clientSiteId, foreignSiteId]) {
    await db!.clientSite.create({ data: { id, name: `related-${id}`, domain: `${id}.invalid`, language: 'cs' } })
  }
  const tagIds = [randomUUID(), randomUUID(), randomUUID()]
  tags.push(...tagIds)
  for (const id of tagIds) await db!.tag.create({ data: { id, name: id, slug: id } })
  const article = async (
    options: {
      clientSiteId?: string
      status?: 'draft' | 'published'
      releaseAt?: Date | null
      deletedAt?: Date | null
      tags?: string[]
    } = {},
  ) => {
    const row = await db!.article.create({
      data: {
        clientSiteId: options.clientSiteId ?? clientSiteId,
        userId,
        slug: randomUUID(),
        language: 'cs',
        title: 'Related visibility fixture',
        content: '<p>Synthetic fixture</p>',
        status: options.status ?? 'published',
        releaseAt: options.releaseAt ?? null,
        deletedAt: options.deletedAt ?? null,
      },
    })
    for (const tagId of options.tags ?? []) await db!.articleTag.create({ data: { articleId: row.id, tagId } })
    return row
  }
  const current = await article({ tags: tagIds })
  const highest = await article({ tags: tagIds.slice(0, 2) })
  const lower = await article({ tags: tagIds.slice(0, 1) })
  const future = await article({ tags: tagIds, releaseAt: new Date('2099-01-01') })
  const draft = await article({ tags: tagIds, status: 'draft' })
  const deleted = await article({ tags: tagIds, deletedAt: new Date() })
  const foreign = await article({ tags: tagIds, clientSiteId: foreignSiteId })
  const translated = async (row: typeof current, status: 'PUBLISHED' | 'PENDING' = 'PUBLISHED') => {
    const slug = randomUUID()
    await db!.articleTranslation.create({
      data: {
        articleId: row.id,
        clientSiteId: row.clientSiteId,
        language: 'en',
        status,
        slug,
        title: 'Translated fixture',
        content: '<p>Translated fixture</p>',
      },
    })
    return slug
  }
  const run = async (
    options: {
      viewer?: 'owner' | 'foreign' | 'superadmin'
      slug?: string
      locale?: string
      take?: number
    } = {},
  ) => {
    const viewer = options.viewer
      ? {
          id: userId,
          role: options.viewer === 'superadmin' ? 'superadmin' : 'admin',
          clientSiteId: options.viewer === 'owner' ? clientSiteId : foreignSiteId,
        }
      : null
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('getSessionUser', async () => viewer)
    vi.stubGlobal('readAnonSession', () => null)
    vi.stubGlobal('getRouterParam', () => options.slug ?? current.slug)
    vi.stubGlobal('getPagination', async () => ({ take: options.take ?? 2, skip: 0 }))
    vi.stubGlobal('getQuery', () => ({ clientSiteId, locale: options.locale ?? 'cs' }))
    vi.stubGlobal('hasArticleAdminAccess', hasArticleAdminAccess)
    vi.stubGlobal('resolveArticleBySlug', resolveArticleBySlug)
    vi.stubGlobal('localizeArticles', localizeArticles)
    vi.stubGlobal('prisma', db)
    const handler = (await import('../../../server/api/articles/[id]/related/index.get')).default
    return handler({} as never)
  }
  return { clientSiteId, current, highest, lower, future, draft, deleted, foreign, article, translated, run }
}

describe.skipIf(!enabled)('public related-article visibility on PostgreSQL', () => {
  it('filters scheduled, deleted, draft and foreign candidates before ranking/limiting', async () => {
    const data = await fixture()
    const result = await data.run()
    expect(result.map((article) => article.id)).toEqual([data.highest.id, data.lower.id])
    expect(result.every((article) => article.clientSiteId === data.clientSiteId)).toBe(true)
    expect(
      result.every((article) => !('content' in article) && !('reactions' in article) && !article.likedByUser),
    ).toBe(true)
  })

  it('includes released candidates and keeps same-tenant tag ranking', async () => {
    const data = await fixture()
    await db!.article.update({ where: { id: data.future.id }, data: { releaseAt: new Date('2000-01-01') } })
    expect((await data.run()).map((article) => article.id)).toEqual([data.future.id, data.highest.id])
  })

  it.each(['draft', 'future', 'deleted'] as const)(
    'denies a public related lookup through a %s source',
    async (kind) => {
      const data = await fixture()
      await expect(data.run({ slug: data[kind].slug })).rejects.toMatchObject({ statusCode: 404 })
    },
  )

  it('denies a related lookup when its tenant is deleted', async () => {
    const data = await fixture()
    await db!.clientSite.update({ where: { id: data.clientSiteId }, data: { deletedAt: new Date() } })
    await expect(data.run()).rejects.toMatchObject({ statusCode: 404 })
  })

  it('treats a foreign administrator as a public reader for source and candidates', async () => {
    const data = await fixture()
    expect((await data.run({ viewer: 'foreign' })).map((article) => article.id)).toEqual([
      data.highest.id,
      data.lower.id,
    ])
    await expect(data.run({ viewer: 'foreign', slug: data.future.slug })).rejects.toMatchObject({ statusCode: 404 })
  })

  it.each(['owner', 'superadmin'] as const)('preserves undeleted scheduled/draft preview for %s', async (viewer) => {
    const data = await fixture()
    const result = await data.run({ viewer, slug: data.draft.slug, take: 10 })
    expect(result.map((article) => article.id)).toContain(data.future.id)
    expect(result.map((article) => article.id)).not.toContain(data.deleted.id)
    expect(result.map((article) => article.id)).not.toContain(data.foreign.id)
    await expect(data.run({ viewer, slug: data.deleted.slug })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('preserves published translation overlays after public candidate filtering', async () => {
    const data = await fixture()
    const currentSlug = await data.translated(data.current)
    const highestSlug = await data.translated(data.highest)
    await data.translated(data.lower, 'PENDING')
    await data.translated(data.future)
    const result = await data.run({ slug: currentSlug, locale: 'en' })
    expect(result.map((article) => article.id)).toEqual([data.highest.id, data.lower.id])
    expect(result[0]).toMatchObject({ slug: highestSlug, title: 'Translated fixture', language: 'en' })
    expect(result[1]).toMatchObject({ slug: data.lower.slug, language: 'cs' })
  })

  it('does not bypass source release scheduling through a published translation slug', async () => {
    const data = await fixture()
    const futureSlug = await data.translated(data.future)
    await expect(data.run({ slug: futureSlug, locale: 'en' })).rejects.toMatchObject({ statusCode: 404 })
  })
})

// @vitest-environment node
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { PolicyPlugin } from '@zenstackhq/plugin-policy'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { createDatabaseClient } from '../../../server/utils/database'

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

const fixture = async (includeDraft = false) => {
  const clientSiteId = randomUUID()
  const authorId = randomUUID()
  const readerId = randomUUID()
  sites.push(clientSiteId)
  users.push(authorId, readerId)
  await db!.clientSite.create({
    data: { id: clientSiteId, name: `tag-${clientSiteId}`, domain: `${clientSiteId}.invalid` },
  })
  await db!.user.create({
    data: { id: authorId, username: authorId, email: `${authorId}@example.invalid`, role: 'admin', clientSiteId },
  })
  await db!.user.create({ data: { id: readerId, username: readerId, email: `${readerId}@example.invalid` } })
  const tag = await db!.tag.create({ data: { clientSiteId, name: 'Tag fixture', slug: 'tag-fixture' } })
  tags.push(tag.id)
  const articles = []
  for (const kind of ['visible', 'future', 'deleted', ...(includeDraft ? ['draft'] : [])]) {
    const article = await db!.article.create({
      data: {
        clientSiteId,
        userId: authorId,
        slug: randomUUID(),
        title: `${kind} source`,
        content: '<p>Visible body</p>',
        language: 'cs',
        status: kind === 'draft' ? 'draft' : 'published',
        releaseAt: kind === 'future' ? new Date('2099-01-01') : null,
        deletedAt: kind === 'deleted' ? new Date() : null,
        prompt: 'Private editorial brief',
        savedAmount: 12.5,
        savedTimeMinutes: 60,
      },
    })
    await db!.articleTag.create({ data: { articleId: article.id, tagId: tag.id } })
    articles.push({ kind, ...article })
  }
  const run = async (viewer: 'reader' | 'owner' | 'anonymous' = 'reader') => {
    const user =
      viewer === 'anonymous'
        ? null
        : viewer === 'owner'
          ? { id: authorId, role: 'admin' as const, clientSiteId }
          : { id: readerId, role: 'reader' as const, clientSiteId: null }
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('getSessionUser', async () => user)
    vi.stubGlobal('getRouterParam', () => tag.id)
    vi.stubGlobal('getPagination', async () => ({ take: 20, skip: 0 }))
    vi.stubGlobal('getEnhancedPrisma', async () => db!.$use(new PolicyPlugin()).$setAuth(user ?? undefined))
    const route = (await import('../../../server/api/tags/[id]/index.get')).default
    return route({} as never)
  }
  return { run, articles, clientSiteId, tag, authorId }
}

describe.skipIf(!enabled)('tag ID reader boundary on PostgreSQL', () => {
  it('keeps published reader access while omitting private editorial and accounting fields', async () => {
    const data = await fixture()
    const result = await data.run()
    const visible = result.articles.find((article) => article.id === data.articles[0]!.id)
    expect(visible).toMatchObject({ title: 'visible source', content: '<p>Visible body</p>', likes: 0, comments: 0 })
    for (const field of ['prompt', 'savedAmount', 'savedTimeMinutes', 'format', 'structureVariant', 'newsUrl'])
      expect(visible).not.toHaveProperty(field)
  })

  it('filters future, deleted and unreadable draft associations before pagination', async () => {
    const data = await fixture(true)
    const result = await data.run()
    expect(result.articles.map((article) => article.id)).toEqual([data.articles[0]!.id])
  })

  it('preserves owning-admin draft and scheduled previews while excluding deleted articles', async () => {
    const data = await fixture(true)
    const result = await data.run('owner')
    expect(new Set(result.articles.map((article) => article.id))).toEqual(
      new Set(data.articles.filter((article) => article.kind !== 'deleted').map((article) => article.id)),
    )
  })

  it('does not expose a deleted tenant through its tag ID', async () => {
    const data = await fixture()
    await db!.clientSite.update({ where: { id: data.clientSiteId }, data: { deletedAt: new Date() } })
    await expect(data.run()).rejects.toMatchObject({ statusCode: 404 })
  })

  it('keeps global-tag previews scoped to the active tenant while retaining public reader access', async () => {
    const data = await fixture(true)
    await db!.tag.update({ where: { id: data.tag.id }, data: { clientSiteId: null } })
    const foreignSiteId = randomUUID()
    sites.push(foreignSiteId)
    await db!.clientSite.create({
      data: { id: foreignSiteId, name: `tag-${foreignSiteId}`, domain: `${foreignSiteId}.invalid` },
    })
    const foreign = await db!.article.create({
      data: {
        clientSiteId: foreignSiteId,
        userId: data.authorId,
        slug: randomUUID(),
        language: 'cs',
        title: 'Foreign hidden article',
        content: '<p>Private foreign draft</p>',
        status: 'draft',
      },
    })
    await db!.articleTag.create({ data: { articleId: foreign.id, tagId: data.tag.id } })
    const owner = await data.run('owner')
    expect(new Set(owner.articles.map((article) => article.id))).toEqual(
      new Set(data.articles.filter((article) => article.kind !== 'deleted').map((article) => article.id)),
    )
    expect(owner.articles.map((article) => article.id)).not.toContain(foreign.id)
    expect((await data.run()).articles.map((article) => article.id)).toEqual([data.articles[0]!.id])
  })

  it('retains authentication at the existing reader boundary', async () => {
    const data = await fixture()
    await expect(data.run('anonymous')).rejects.toMatchObject({ statusCode: 401 })
  })
})

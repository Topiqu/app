// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { PolicyPlugin } from '@zenstackhq/plugin-policy'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { createDatabaseClient } from '../../../server/utils/database'

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url) : null

describe.skipIf(!enabled)('activity access on PostgreSQL', () => {
  const suffix = randomUUID()
  const siteId = randomUUID()
  const authorId = randomUUID()
  const ownerId = randomUUID()
  const readerId = randomUUID()
  const removedOwnerId = randomUUID()
  const archivedId = randomUUID()
  const commentId = randomUUID()
  const aiAuthorId = randomUUID()
  const aiDraftId = randomUUID()
  const otherSiteId = randomUUID()
  const otherDraftId = randomUUID()
  const userIds = [authorId, ownerId, readerId, removedOwnerId, aiAuthorId]

  const auth = (id: string) => ({ id, role: 'reader' as const, clientSiteId: '' })
  const asUser = (id: string) => db!.$use(new PolicyPlugin()).$setAuth(auth(id))

  beforeAll(async () => {
    await db!.clientSite.create({ data: { id: siteId, name: suffix, domain: `${suffix}.test` } })
    for (const [index, id] of userIds.entries())
      await db!.user.create({ data: { id, username: `${suffix}-${index}`, email: `${id}@example.test` } })
    await db!.tenantMembership.create({ data: { clientSiteId: siteId, userId: ownerId, role: 'OWNER' } })
    await db!.tenantMembership.create({
      data: { clientSiteId: siteId, userId: removedOwnerId, role: 'OWNER', deletedAt: new Date() },
    })
    await db!.article.create({
      data: {
        id: archivedId,
        clientSiteId: siteId,
        userId: authorId,
        language: 'cs',
        slug: suffix,
        title: 'Previously published article',
        content: 'Test content',
        status: 'archived',
        publishedAt: new Date(),
      },
    })
    for (const userId of [authorId, readerId])
      await db!.articleReaction.create({ data: { articleId: archivedId, userId } })
    await db!.comment.create({
      data: { id: commentId, articleId: archivedId, userId: authorId, content: 'My comment' },
    })
    await db!.user.update({ where: { id: aiAuthorId }, data: { role: 'ai', clientSiteId: siteId } })
    await db!.article.create({
      data: {
        id: aiDraftId,
        clientSiteId: siteId,
        userId: aiAuthorId,
        language: 'cs',
        slug: `ai-${suffix}`,
        title: 'AI draft',
        content: 'Draft by the site AI author',
        status: 'draft',
      },
    })
    await db!.articleReaction.create({ data: { articleId: aiDraftId, userId: ownerId } })
    await db!.comment.create({ data: { articleId: aiDraftId, userId: ownerId, content: 'Owner comment on AI draft' } })
    await db!.clientSite.create({ data: { id: otherSiteId, name: `Other ${suffix}`, domain: `other-${suffix}.test` } })
    await db!.article.create({
      data: {
        id: otherDraftId,
        clientSiteId: otherSiteId,
        userId: readerId,
        language: 'cs',
        slug: `other-${suffix}`,
        title: 'Another site draft',
        content: 'Private content',
        status: 'draft',
      },
    })
    await db!.articleReaction.create({ data: { articleId: otherDraftId, userId: ownerId } })
  })

  afterAll(async () => {
    vi.unstubAllGlobals()
    await db!.clientSite.deleteMany({ where: { id: { in: [siteId, otherSiteId] } } })
    await db!.user.deleteMany({ where: { id: { in: userIds } } })
    await db!.$disconnect()
  })

  it('reproduces a readable reaction with a null inaccessible article', async () => {
    const reactions = await asUser(readerId).articleReaction.findMany({
      where: { userId: readerId },
      include: { article: { select: { id: true } } },
    })
    expect(reactions).toHaveLength(1)
    expect(reactions[0]!.article).toBeNull()
  })

  it.each([
    ['author', authorId],
    ['owner', ownerId],
  ])('lets the %s read an archived article without an active site', async (_, id) => {
    expect(await asUser(id!).article.findUnique({ where: { id: archivedId }, select: { id: true } })).toEqual({
      id: archivedId,
    })
  })

  it.each([
    ['unrelated reader', readerId],
    ['removed owner', removedOwnerId],
  ])('keeps archived articles hidden from an %s', async (_, id) => {
    expect(await asUser(id!).article.findUnique({ where: { id: archivedId }, select: { id: true } })).toBeNull()
  })

  const activity = async (id: string) => {
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('getServerSession', async () => ({ user: auth(id) }))
    vi.stubGlobal('getEnhancedPrisma', async () => asUser(id))
    vi.stubGlobal('getQuery', () => ({ sort: 'createdAt:desc' }))
    vi.stubGlobal('getPagination', async () => ({ skip: 0, take: 10 }))
    return (await import('../../../server/api/users/activity.get')).default({} as never)
  }

  it('returns an empty activity instead of 500 when every liked article is inaccessible', async () => {
    expect(await activity(readerId)).toEqual({
      likedArticles: [],
      comments: [],
      hasMore: { likedArticles: false, comments: false },
    })
  })

  it('retains the author’s own comment and its article metadata', async () => {
    const result = await activity(authorId)
    expect(result.likedArticles.map((article) => article.id)).toEqual([archivedId])
    expect(result.comments).toEqual([
      expect.objectContaining({ id: commentId, articleSlug: suffix, articleTitle: 'Previously published article' }),
    ])
  })

  it('shows the site owner an AI author’s draft and its comments without an active site', async () => {
    const result = await activity(ownerId)
    expect(result.likedArticles.map((article) => article.id)).toEqual([aiDraftId])
    expect(result.comments).toEqual([
      expect.objectContaining({ articleSlug: `ai-${suffix}`, articleTitle: 'AI draft' }),
    ])
  })

  it('allows a superadmin to read an AI draft without a site membership', async () => {
    const adminDb = db!.$use(new PolicyPlugin()).$setAuth({ id: readerId, role: 'superadmin', clientSiteId: '' })
    expect(await adminDb.article.findUnique({ where: { id: aiDraftId }, select: { id: true } })).toEqual({
      id: aiDraftId,
    })
  })

  it('can include an inaccessible liked draft from another site even for an active site admin', async () => {
    const adminDb = db!.$use(new PolicyPlugin()).$setAuth({ id: ownerId, role: 'admin', clientSiteId: siteId })
    const reactions = await adminDb.articleReaction.findMany({
      where: { userId: ownerId },
      select: { articleId: true, article: { select: { id: true } } },
    })
    expect(reactions).toEqual(
      expect.arrayContaining([
        { articleId: aiDraftId, article: { id: aiDraftId } },
        { articleId: otherDraftId, article: null },
      ]),
    )
  })
})

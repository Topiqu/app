// @vitest-environment node
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { PolicyPlugin } from '@zenstackhq/plugin-policy'
import { afterAll, afterEach, describe, expect, it, vi, beforeEach } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'
import { indexCommentThreads } from '../../../shared/utils/commentThreads'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/articleViewerAccess'), 'canReadArticle')
}

await stubImports()

const { createDatabaseClient } = await import('../../../server/utils/database')

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

const fixture = async () => {
  const siteId = randomUUID()
  sites.push(siteId)
  await db!.clientSite.create({ data: { id: siteId, name: `threads-${siteId}`, domain: `${siteId}.test` } })
  const userIds = Array.from({ length: 5 }, () => randomUUID())
  users.push(...userIds)
  for (const id of userIds)
    await db!.user.create({ data: { id, username: `reader-${id}`, email: `${id}@example.invalid` } })
  const userId = userIds[0]!
  const article = await db!.article.create({
    data: {
      clientSiteId: siteId,
      userId,
      slug: randomUUID(),
      language: 'en',
      title: 'Thread fixture',
      content: 'Text',
      status: 'published',
    },
  })
  const query: Record<string, unknown> = {}
  const user = { id: userId, role: 'reader' as const, clientSiteId: siteId }
  const scoped = db!.$use(new PolicyPlugin({ dangerouslyAllowRawSql: true })).$setAuth(user)
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('prisma', db)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getRouterParam', () => article.id)
  vi.stubGlobal('getSessionUser', async () => user)
  vi.stubGlobal('getEnhancedPrisma', async () => scoped)
  vi.stubGlobal('getPagination', async () => ({ skip: 0, take: 5 }))
  vi.stubGlobal('getQuery', () => query)
  const handler = (await import('../../../server/api/comments/[id]/index.get')).default
  const createComment = (content: string, parentId?: string, createdAt = new Date()) =>
    db!.comment.create({ data: { articleId: article.id, userId, content, parentId, createdAt } })
  return { siteId, userId, userIds, article, query, run: () => handler({} as never), createComment }
}

describe.skipIf(!enabled)('comment reads on PostgreSQL', () => {
  it('ranks only LIKE votes and preserves counts, own vote, publication likes and emoji aggregates', async () => {
    const f = await fixture()
    const liked = await f.createComment('Liked', undefined, new Date('2026-10-01'))
    const disliked = await f.createComment('Disliked', undefined, new Date('2026-10-02'))
    await db!.tenantMembership.create({
      data: { clientSiteId: f.siteId, userId: f.userIds[1]!, role: 'MEMBER', scopes: [] },
    })
    for (const userId of f.userIds.slice(0, 2))
      await db!.commentReaction.create({ data: { userId, commentId: liked.id, type: 'LIKE' } })
    for (const userId of f.userIds)
      await db!.commentReaction.create({ data: { userId, commentId: disliked.id, type: 'DISLIKE' } })
    const emoji = await db!.emoji.create({
      data: { clientSiteId: f.siteId, shortcode: 'thread-smile', imageUrl: 'https://example.invalid/smile.webp' },
    })
    for (const userId of f.userIds.slice(0, 3))
      await db!.emojiReaction.create({ data: { userId, commentId: liked.id, emojiId: emoji.id } })
    f.query.sort = 'likes:desc'
    const result = await f.run()
    expect(result.comments.map((comment) => comment.id)).toEqual([liked.id, disliked.id])
    expect(result.comments[0]).toMatchObject({
      likes: 2,
      dislikes: 0,
      userReaction: { type: 'LIKE' },
      publicationLikes: 1,
      emojiReactions: [{ emojiId: emoji.id, count: 3 }],
    })
    expect(result.comments[1]).toMatchObject({ likes: 0, dislikes: 5, userReaction: { type: 'DISLIKE' } })
    expect(JSON.stringify(result)).not.toContain(f.userIds[1])
  })

  it('bounds initial replies and retrieves every remaining sibling through stable database cursors', async () => {
    const f = await fixture()
    const root = await f.createComment('Root')
    const replies = Array.from({ length: 87 }, (_, index) => ({
      id: randomUUID(),
      articleId: f.article.id,
      userId: f.userId,
      parentId: root.id,
      content: `Reply ${index}`,
      createdAt: new Date(Date.UTC(2026, 9, 1, 0, 0, index)),
    }))
    await db!.comment.createMany({ data: replies })
    const first = await f.run()
    expect(indexCommentThreads(first.comments).size).toBe(60)
    const loaded = new Set(first.comments[0]!.replies.map((reply) => reply.id))
    f.query.parent = root.id
    f.query.cursor = first.comments[0]!.repliesCursor
    let more = true
    while (more) {
      const next = await f.run()
      for (const reply of next.comments) {
        expect(loaded.has(reply.id)).toBe(false)
        loaded.add(reply.id)
      }
      f.query.cursor = next.parent!.cursor
      more = next.parent!.hasMore
    }
    expect(loaded.size).toBe(87)
  })

  it('keeps soft-deleted parent context but hides its content and rejects a future article', async () => {
    const f = await fixture()
    const root = await f.createComment('Private deleted content')
    const reply = await f.createComment('Visible reply', root.id)
    await db!.comment.update({ where: { id: root.id }, data: { deletedAt: new Date() } })
    f.query.target = reply.id
    const result = await f.run()
    expect(result.comments[0]).toMatchObject({ id: root.id, content: '', deletedAt: expect.any(Date) })
    expect(result.comments[0]?.replies[0]?.id).toBe(reply.id)
    await db!.article.update({ where: { id: f.article.id }, data: { releaseAt: new Date('2099-01-01') } })
    await expect(f.run()).rejects.toMatchObject({ statusCode: 404 })
  })
})

beforeEach(stubImports)

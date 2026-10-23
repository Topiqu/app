// @vitest-environment node
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { PolicyPlugin } from '@zenstackhq/plugin-policy'
import { afterAll, afterEach, describe, expect, it, vi, beforeEach } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

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

afterEach(() => {
  vi.unstubAllGlobals()
})
afterAll(async () => {
  if (!db) return
  await db.clientSite.deleteMany({ where: { id: { in: sites } } })
  await db.user.deleteMany({ where: { id: { in: users } } })
  await db.$disconnect()
})

const fixture = async () => {
  const siteId = randomUUID()
  const otherSiteId = randomUUID()
  const userId = randomUUID()
  const otherUserId = randomUUID()
  sites.push(siteId, otherSiteId)
  users.push(userId, otherUserId)
  for (const id of [siteId, otherSiteId])
    await db!.clientSite.create({ data: { id, name: `visibility-${id}`, domain: `${id}.test` } })
  for (const id of [userId, otherUserId])
    await db!.user.create({ data: { id, username: `reader-${id}`, email: `${id}@example.invalid` } })
  const article = await db!.article.create({
    data: {
      clientSiteId: siteId,
      userId,
      slug: randomUUID(),
      language: 'en',
      title: 'Visibility fixture',
      content: 'Text',
      status: 'published',
    },
  })
  const comment = await db!.comment.create({ data: { articleId: article.id, userId, content: 'Visible comment' } })
  const emoji = await db!.emoji.create({
    data: { clientSiteId: siteId, shortcode: 'smile', imageUrl: 'https://example.invalid/smile.webp' },
  })
  const foreignEmoji = await db!.emoji.create({
    data: { clientSiteId: otherSiteId, shortcode: 'smile', imageUrl: 'https://example.invalid/smile.webp' },
  })
  const user = { id: userId, role: 'reader' as const, clientSiteId: siteId }
  const scoped = db!.$use(new PolicyPlugin({ dangerouslyAllowRawSql: true })).$setAuth(user)
  return { siteId, otherSiteId, userId, otherUserId, article, comment, emoji, foreignEmoji, user, scoped }
}

describe.skipIf(!enabled)('comment interaction policies on PostgreSQL', () => {
  it('allows visible comments by the authenticated actor and rejects forged ownership', async () => {
    const f = await fixture()
    await expect(
      f.scoped.comment.create({ data: { articleId: f.article.id, userId: f.userId, content: 'Allowed' } }),
    ).resolves.toMatchObject({ content: 'Allowed' })
    await expect(
      f.scoped.comment.create({ data: { articleId: f.article.id, userId: f.otherUserId, content: 'Forged' } }),
    ).rejects.toThrow()
    expect(await db!.comment.count({ where: { articleId: f.article.id, content: 'Forged' } })).toBe(0)
  })

  it.each(['draft', 'future', 'article-deleted', 'site-deleted'] as const)(
    'rejects direct-policy writes to %s content',
    async (state) => {
      const f = await fixture()
      if (state === 'site-deleted')
        await db!.clientSite.update({ where: { id: f.siteId }, data: { deletedAt: new Date() } })
      else
        await db!.article.update({
          where: { id: f.article.id },
          data:
            state === 'draft'
              ? { status: 'draft' }
              : state === 'future'
                ? { releaseAt: new Date('2099-01-01') }
                : { deletedAt: new Date() },
        })
      await expect(
        f.scoped.comment.create({ data: { articleId: f.article.id, userId: f.userId, content: 'Hidden' } }),
      ).rejects.toThrow()
      await expect(
        f.scoped.emojiReaction.create({ data: { userId: f.userId, commentId: f.comment.id, emojiId: f.emoji.id } }),
      ).rejects.toThrow()
    },
  )

  it('preserves same-tenant admin preview but denies a foreign administrator', async () => {
    const f = await fixture()
    await db!.article.update({ where: { id: f.article.id }, data: { status: 'draft' } })
    const policy = db!.$use(new PolicyPlugin())
    await expect(
      policy
        .$setAuth({ ...f.user, role: 'admin' })
        .comment.create({ data: { articleId: f.article.id, userId: f.userId, content: 'Preview' } }),
    ).resolves.toMatchObject({ content: 'Preview' })
    await expect(
      policy
        .$setAuth({ ...f.user, role: 'admin', clientSiteId: f.otherSiteId })
        .comment.create({ data: { articleId: f.article.id, userId: f.userId, content: 'Foreign' } }),
    ).rejects.toThrow()
  })

  it('rejects cross-publication emoji references and soft-deleted targets', async () => {
    const f = await fixture()
    const data = { userId: f.userId, commentId: f.comment.id, emojiId: f.foreignEmoji.id }
    await expect(f.scoped.emojiReaction.create({ data })).rejects.toThrow()
    await db!.comment.update({ where: { id: f.comment.id }, data: { deletedAt: new Date() } })
    await expect(f.scoped.emojiReaction.create({ data: { ...data, emojiId: f.emoji.id } })).rejects.toThrow()
    expect(await db!.emojiReaction.count({ where: { commentId: f.comment.id } })).toBe(0)
  })

  it('serializes eight overlapping toggles without unique violations or lost actions', async () => {
    const f = await fixture()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('getSessionUser', async () => f.user)
    vi.stubGlobal('getEnhancedPrisma', async () => f.scoped)
    vi.stubGlobal('readValidatedBody', async () => ({ commentId: f.comment.id, emojiId: f.emoji.id }))
    const handler = (await import('../../../server/api/emojis/reaction.post')).default
    const results = await Promise.all(Array.from({ length: 8 }, () => handler({} as never)))
    expect(results.filter((result) => result.created)).toHaveLength(4)
    expect(await db!.emojiReaction.count({ where: { userId: f.userId, commentId: f.comment.id } })).toBe(0)
  })
})

beforeEach(stubImports)

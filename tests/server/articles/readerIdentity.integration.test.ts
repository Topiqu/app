// @vitest-environment node
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { PolicyPlugin } from '@zenstackhq/plugin-policy'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { createDatabaseClient } from '../../../server/utils/database'
import { isUniqueViolation } from '../../../server/utils/databaseError'

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
  const clientSiteId = randomUUID()
  const userId = randomUUID()
  sites.push(clientSiteId)
  users.push(userId)
  await db!.clientSite.create({
    data: { id: clientSiteId, name: `identity-${clientSiteId}`, domain: `${clientSiteId}.test` },
  })
  await db!.user.create({ data: { id: userId, email: `${userId}@example.invalid`, username: `identity-${userId}` } })
  const article = await db!.article.create({
    data: {
      clientSiteId,
      userId,
      slug: randomUUID(),
      language: 'en',
      title: 'Identity test',
      content: 'Test content',
      status: 'published',
    },
  })
  return { articleId: article.id, userId }
}

describe.skipIf(!enabled)('reader identity uniqueness on PostgreSQL', () => {
  for (const identity of ['signed-in', 'anonymous'] as const) {
    for (const kind of ['reaction', 'feedback', 'share'] as const) {
      it(`stores one ${kind} for overlapping requests from one ${identity} reader`, async () => {
        const { articleId, userId } = await fixture()
        const data = {
          articleId,
          userId: identity === 'signed-in' ? userId : null,
          sessionId: identity === 'anonymous' ? randomUUID() : null,
        }
        const write = () =>
          kind === 'reaction'
            ? db!.articleReaction.create({ data })
            : kind === 'feedback'
              ? db!.articleFeedback.create({ data: { ...data, isHelpful: true } })
              : db!.articleShare.create({ data: { ...data, platform: 'OTHER' } })
        const outcomes = await Promise.allSettled(Array.from({ length: 8 }, write))
        expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
        const rejected = outcomes.filter((outcome) => outcome.status === 'rejected')
        expect(rejected).toHaveLength(7)
        for (const result of rejected) expect(isUniqueViolation(result.reason)).toBe(true)
      })
    }
  }

  it('keeps distinct readers and share platforms independent', async () => {
    const { articleId, userId } = await fixture()
    await db!.articleShare.create({ data: { articleId, userId, platform: 'OTHER' } })
    await db!.articleShare.create({ data: { articleId, userId, platform: 'EMAIL' } })
    await db!.articleShare.create({ data: { articleId, sessionId: randomUUID(), platform: 'OTHER' } })
    expect(await db!.articleShare.count({ where: { articleId } })).toBe(3)
  })

  const routes = async (identity: 'signed-in' | 'anonymous', kind: 'reaction' | 'feedback' | 'share') => {
    const { articleId, userId } = await fixture()
    const sessionId = randomUUID()
    const user = identity === 'signed-in' ? { id: userId, role: 'reader' as const } : null
    const scoped = db!.$use(new PolicyPlugin()).$setAuth(user ?? undefined)
    let reads = 0
    let release!: () => void
    const bothRead = new Promise<void>((done) => {
      release = done
    })
    const reaction = scoped.articleReaction
    const feedback = scoped.articleFeedback
    const delegate = kind === 'reaction' ? reaction : feedback
    const read = delegate.findFirst.bind(delegate)
    const findFirst: typeof read = async (...args) => {
      const previous = await read(...args)
      if (++reads <= 2) {
        if (reads === 2) release()
        await bothRead
      }
      return previous
    }
    const guarded = {
      article: scoped.article,
      articleReaction: {
        findFirst,
        create: reaction.create.bind(reaction),
        deleteMany: reaction.deleteMany.bind(reaction),
        count: reaction.count.bind(reaction),
      },
      articleFeedback: { findFirst, create: feedback.create.bind(feedback), update: feedback.update.bind(feedback) },
    }
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('prisma', db)
    vi.stubGlobal('getEnhancedPrisma', async () => guarded)
    vi.stubGlobal('getSessionUser', async () => user)
    vi.stubGlobal('getRouterParam', () => articleId)
    vi.stubGlobal('issueAnonSession', () => sessionId)
    vi.stubGlobal('issueAnalyticsSession', () => sessionId)
    vi.stubGlobal('articleAnalyticsAllowed', () => true)
    vi.stubGlobal('ipKey', () => 'test-ip')
    vi.stubGlobal('consumeRateLimit', async () => true)
    vi.stubGlobal('isUniqueViolation', isUniqueViolation)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('reportCaughtError', vi.fn())
    let body: unknown = { isHelpful: false, reason: 'Needs examples', platform: 'OTHER' }
    vi.stubGlobal('readBody', async () => body)
    vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (input: unknown) => unknown) => parse(body))
    const handler =
      kind === 'reaction'
        ? (await import('../../../server/api/articles/[id]/reaction.post')).default
        : kind === 'feedback'
          ? (await import('../../../server/api/articles/[id]/feedback.post')).default
          : (await import('../../../server/api/articles/[id]/share.post')).default
    return {
      run: () => handler({} as never),
      articleId,
      sessionId,
      changeBody: (value: unknown) => {
        body = value
      },
    }
  }

  for (const identity of ['signed-in', 'anonymous'] as const) {
    for (const kind of ['reaction', 'feedback', 'share'] as const) {
      it(`handles overlapping ${identity} ${kind} requests without a false server failure`, async () => {
        const { run, articleId } = await routes(identity, kind)
        const results = await Promise.all([run(), run()])
        if (kind === 'reaction') {
          expect(results).toEqual([
            { liked: true, likes: 1 },
            { liked: true, likes: 1 },
          ])
          expect(await db!.articleReaction.count({ where: { articleId } })).toBe(1)
        } else if (kind === 'feedback') {
          expect(results).toMatchObject([{ success: true }, { success: true }])
          expect(await db!.articleFeedback.count({ where: { articleId } })).toBe(1)
        } else {
          expect(results.filter((result) => 'counted' in result && result.counted)).toHaveLength(1)
          expect(await db!.article.findUniqueOrThrow({ where: { id: articleId } })).toMatchObject({ shared: 1 })
        }
      })

      it(`rejects ${identity} ${kind} activity before the article release window`, async () => {
        const { run, articleId } = await routes(identity, kind)
        await db!.article.update({ where: { id: articleId }, data: { releaseAt: new Date(Date.now() + 60_000) } })
        const results = await Promise.allSettled([run(), run()])
        for (const result of results) {
          expect(result.status).toBe('rejected')
          if (result.status === 'rejected') expect(result.reason).toMatchObject({ statusCode: 404 })
        }
        expect(await db!.articleReaction.count({ where: { articleId } })).toBe(0)
        expect(await db!.articleFeedback.count({ where: { articleId } })).toBe(0)
        expect(await db!.articleShare.count({ where: { articleId } })).toBe(0)
      })
    }
  }

  it('lets an anonymous reader revise only feedback bound to the same server cookie', async () => {
    const { run, articleId, changeBody } = await routes('anonymous', 'feedback')
    await Promise.all([run(), run()])
    changeBody({ isHelpful: true })
    await expect(run()).resolves.toMatchObject({ success: true, feedback: { isHelpful: true, reason: null } })
    expect(await db!.articleFeedback.count({ where: { articleId } })).toBe(1)
    vi.stubGlobal('issueAnonSession', () => randomUUID())
    await expect(run()).resolves.toMatchObject({ success: true })
    expect(await db!.articleFeedback.count({ where: { articleId } })).toBe(2)
  })

  it('keeps a saved like successful when its notification fails', async () => {
    const { run, articleId } = await routes('anonymous', 'reaction')
    vi.stubGlobal('prisma', {
      notification: { create: vi.fn().mockRejectedValue(new Error('Synthetic notification failure')) },
      articleReaction: db!.articleReaction,
    })
    await expect(Promise.all([run(), run()])).resolves.toMatchObject([{ liked: true }, { liked: true }])
    expect(await db!.articleReaction.count({ where: { articleId } })).toBe(1)
    expect(reportCaughtError).toHaveBeenCalledOnce()
  })

  it('lets an anonymous reader remove only their own cookie-bound like', async () => {
    const { run, articleId } = await routes('anonymous', 'reaction')
    await Promise.all([run(), run()])
    await expect(run()).resolves.toEqual({ liked: false, likes: 0 })
    expect(await db!.articleReaction.count({ where: { articleId } })).toBe(0)
  })
})

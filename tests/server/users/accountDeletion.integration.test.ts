// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createDatabaseClient } from '../../../server/utils/database'

mockNuxtImport('useRuntimeConfig', () => () => ({
  public: { baseUrl: 'https://app.example.test', cdnUrl: 'https://cdn.example.test' },
}))

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url) : null

describe.skipIf(!enabled)('account deletion on PostgreSQL', () => {
  const suffix = randomUUID()
  const ownerId = randomUUID()
  const otherOwnerId = randomUUID()
  const readerId = randomUUID()
  const ownedSiteId = randomUUID()
  const otherSiteId = randomUUID()
  const articleOnOtherBlogId = randomUUID()
  const commentId = randomUUID()
  const replyId = randomUUID()
  const userIds = [ownerId, otherOwnerId, readerId]
  const siteIds = [ownedSiteId, otherSiteId]
  const event = {} as never

  const load = () => import('../../../server/utils/accountDeletion')

  beforeAll(async () => {
    await db!.clientSite.create({ data: { id: ownedSiteId, name: suffix, domain: `${suffix}.test` } })
    await db!.clientSite.create({ data: { id: otherSiteId, name: `other-${suffix}`, domain: `other-${suffix}.test` } })
    for (const [index, id] of userIds.entries())
      await db!.user.create({
        data: {
          id,
          username: `${suffix}-${index}`,
          email: `${id}@example.test`,
          bio: 'Personal bio',
          password: 'hash',
        },
      })
    await db!.tenantMembership.create({ data: { clientSiteId: ownedSiteId, userId: ownerId, role: 'OWNER' } })
    await db!.tenantMembership.create({ data: { clientSiteId: otherSiteId, userId: otherOwnerId, role: 'OWNER' } })
    await db!.article.create({
      data: {
        id: articleOnOtherBlogId,
        clientSiteId: otherSiteId,
        userId: ownerId,
        language: 'cs',
        slug: `kept-${suffix}`,
        title: 'Written for another blog',
        content: 'Body',
        status: 'published',
      },
    })
    await db!.comment.create({
      data: { id: commentId, articleId: articleOnOtherBlogId, userId: ownerId, content: 'My name is Alice' },
    })
    await db!.comment.create({
      data: { id: replyId, articleId: articleOnOtherBlogId, userId: readerId, content: `@${suffix}-0 thanks, ann` },
    })
    await db!.notification.create({
      data: { userId: readerId, type: 'FOLLOW', message: `${suffix}-0 started following you.` },
    })
    await db!.notification.create({
      data: { userId: readerId, type: 'FOLLOW', message: `x${suffix}-0y kept` },
    })
    await db!.follow.create({ data: { followerId: readerId, followedId: ownerId } })
    await db!.account.create({ data: { userId: ownerId, providerId: 'github', accountId: `gh-${suffix}` } })
    await db!.session.create({
      data: { token: `session-${suffix}`, userId: ownerId, expiresAt: new Date(Date.now() + 60_000) },
    })
  })

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('AUTH_SECRET', 'test-secret')
    vi.stubGlobal('prisma', db)
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { baseUrl: 'https://app.example.test', cdnUrl: 'https://cdn' },
    }))
    vi.stubGlobal('languageTag', () => 'en-GB')
    vi.stubGlobal('getIp', () => '192.0.2.1')
    vi.stubGlobal('invalidateAuthor', vi.fn())
    vi.stubGlobal('invalidateFeed', vi.fn())
    vi.stubGlobal('uncache', vi.fn())
    vi.stubGlobal('tenantHostKey', (host: string) => host)
    vi.stubGlobal('domainRedirectKey', (host: string) => host)
    vi.stubGlobal('avatarKeyFromUrl', () => null)
    vi.stubGlobal('deleteFromCdn', vi.fn())
    vi.stubGlobal('reportCaughtError', vi.fn())
    vi.stubGlobal(
      'consumeRateLimit',
      vi.fn(async () => true),
    )
    vi.stubGlobal('logAction', vi.fn())
    vi.stubGlobal(
      'sendEmail',
      vi.fn(async () => undefined),
    )
    vi.stubGlobal('useStripe', () => ({ subscriptions: { update: vi.fn(), retrieve: vi.fn() } }))
  })

  afterAll(async () => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    await db!.article.deleteMany({ where: { clientSiteId: { in: siteIds } } })
    await db!.clientSite.deleteMany({ where: { id: { in: siteIds } } })
    await db!.user.deleteMany({ where: { id: { in: userIds } } })
    await db!.$disconnect()
  })

  it('deactivates and restores an account, keeping every record', async () => {
    const { scheduleAccountDeletion, restoreAccount, readDeletionRestoreToken, signDeletionRestoreToken } = await load()

    const { scheduledFor } = await scheduleAccountDeletion(ownerId, [ownedSiteId], event)

    const pending = await db!.user.findUniqueOrThrow({
      where: { id: ownerId },
      select: { deletedAt: true, deletionRequestedAt: true, deletionScheduledFor: true },
    })
    expect(pending.deletedAt).not.toBeNull()
    expect(pending.deletionScheduledFor).toEqual(scheduledFor)
    expect(await db!.session.count({ where: { userId: ownerId } })).toBe(0)
    const closing = await db!.clientSite.findUniqueOrThrow({
      where: { id: ownedSiteId },
      select: { closingAt: true, deletedAt: true },
    })
    expect(closing).toEqual({ closingAt: scheduledFor, deletedAt: null })

    const token = signDeletionRestoreToken(ownerId, pending.deletionRequestedAt!, pending.deletionScheduledFor!)
    await expect(restoreAccount(readDeletionRestoreToken(token)!, event)).resolves.toEqual({ billing: 'resumed' })

    const restored = await db!.user.findUniqueOrThrow({
      where: { id: ownerId },
      select: { deletedAt: true, deletionRequestedAt: true, username: true },
    })
    expect(restored).toEqual({ deletedAt: null, deletionRequestedAt: null, username: `${suffix}-0` })
    const kept = await db!.clientSite.findUniqueOrThrow({ where: { id: ownedSiteId }, select: { closingAt: true } })
    expect(kept.closingAt).toBeNull()

    // The same link must not work twice.
    await expect(restoreAccount(readDeletionRestoreToken(token)!, event)).resolves.toBe(false)
  })

  it('anonymises after the period, keeps articles on other blogs and frees the email', async () => {
    const { scheduleAccountDeletion, anonymizeAccount } = await load()

    const { scheduledFor } = await scheduleAccountDeletion(ownerId, [ownedSiteId], event)

    await expect(anonymizeAccount(ownerId, new Date(scheduledFor.getTime() - 1000))).resolves.toBe(false)
    await expect(anonymizeAccount(ownerId, scheduledFor)).resolves.toBe(true)

    const user = await db!.user.findUniqueOrThrow({
      where: { id: ownerId },
      select: { email: true, username: true, bio: true, password: true, anonymizedAt: true, deletedAt: true },
    })
    expect(user.email).toMatch(/@deleted\.invalid$/)
    expect(user.username).toMatch(/^deleted-/)
    expect(user.bio).toBeNull()
    expect(user.password).toBeNull()
    expect(user.anonymizedAt).toEqual(scheduledFor)
    expect(user.deletedAt).not.toBeNull()

    const article = await db!.article.findUniqueOrThrow({
      where: { id: articleOnOtherBlogId },
      select: { deletedAt: true, status: true, userId: true },
    })
    expect(article).toEqual({ deletedAt: null, status: 'published', userId: ownerId })

    const comment = await db!.comment.findUniqueOrThrow({
      where: { id: commentId },
      select: { content: true, deletedAt: true },
    })
    expect(comment.content).toBe('[deleted]')
    expect(comment.deletedAt).not.toBeNull()

    // The real regular expressions: the name goes from other people's rows, and a longer word containing it stays.
    const reply = await db!.comment.findUniqueOrThrow({ where: { id: replyId }, select: { content: true } })
    expect(reply.content).toBe(`@${user.username} thanks, ann`)
    const messages = await db!.notification.findMany({ where: { userId: readerId }, select: { message: true } })
    expect(messages.map(({ message }) => message).sort()).toEqual(
      [`${user.username} started following you.`, `x${suffix}-0y kept`].sort(),
    )

    expect(await db!.account.count({ where: { userId: ownerId } })).toBe(0)
    expect(await db!.tenantMembership.count({ where: { userId: ownerId } })).toBe(0)
    expect(await db!.follow.count({ where: { followedId: ownerId } })).toBe(0)

    const site = await db!.clientSite.findUniqueOrThrow({
      where: { id: ownedSiteId },
      select: { deletedAt: true, closingAt: true },
    })
    expect(site.deletedAt).toEqual(scheduledFor)
    expect(site.closingAt).toBeNull()
    const otherSite = await db!.clientSite.findUniqueOrThrow({
      where: { id: otherSiteId },
      select: { deletedAt: true },
    })
    expect(otherSite.deletedAt).toBeNull()

    // A second run must be a no-op, and the old address must be free to register again.
    await expect(anonymizeAccount(ownerId, scheduledFor)).resolves.toBe(false)
    expect(await db!.user.count({ where: { email: `${ownerId}@example.test` } })).toBe(0)
  })
})

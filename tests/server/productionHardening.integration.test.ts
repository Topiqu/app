// @vitest-environment node
import argon from 'argon2'
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { invalidateFeed } from '../../server/utils/cache'
import { backfillPolls } from '../../scripts/backfill-polls'
import { appMutationPlugin } from '../../server/utils/prisma'
import { createDatabaseClient } from '../../server/utils/database'
import { articleCardSelect } from '../../server/utils/articleCard'
import { requireTenantMember } from '../../server/utils/tenantMembership'
import { passwordResetHash, passwordResetIdentifier } from '../../server/utils/passwordReset'

vi.mock('../../server/utils/cache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../server/utils/cache')>()),
  invalidateFeed: vi.fn(async () => 'invalidated' as const),
}))

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url).$use(appMutationPlugin) : null
const users: string[] = []
const sites: string[] = []

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
})
afterAll(async () => {
  if (!db) return
  await db.verification.deleteMany({ where: { identifier: { in: users.map(passwordResetIdentifier) } } })
  await db.clientSite.deleteMany({ where: { id: { in: sites } } })
  await db.user.deleteMany({ where: { id: { in: users } } })
  await db.$disconnect()
})

const setup = () => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('prisma', db)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
}

describe.skipIf(!enabled)('production security boundaries on PostgreSQL', () => {
  const pollFixture = async () => {
    const siteId = randomUUID()
    const userId = randomUUID()
    sites.push(siteId)
    users.push(userId)
    await db!.clientSite.create({ data: { id: siteId, name: `polls-${siteId}`, domain: `${siteId}.test` } })
    await db!.user.create({ data: { id: userId, username: `polls-${userId}`, email: `${userId}@example.invalid` } })
    const content = `<div data-type='poll' data-question='Máte zájem?' data-options='[{"label":"Ano"},{"label":"Ne"}]'></div>`
    const article = await db!.article.create({
      data: { clientSiteId: siteId, userId, language: 'cs', slug: randomUUID(), title: 'Legacy poll', content },
    })
    return { siteId, article }
  }

  it('keeps poll backfills dry by default and applies a tenant-scoped repair idempotently', async () => {
    const f = await pollFixture()
    vi.mocked(invalidateFeed).mockClear()
    await expect(backfillPolls(db!, { clientSiteId: f.siteId })).resolves.toMatchObject({
      scanned: 1,
      needed: 1,
      updated: 0,
    })
    expect(await db!.poll.count({ where: { articleId: f.article.id } })).toBe(0)
    expect(invalidateFeed).not.toHaveBeenCalled()
    vi.mocked(invalidateFeed).mockImplementationOnce(async (siteId) => {
      expect(siteId).toBe(f.siteId)
      expect((await db!.article.findUniqueOrThrow({ where: { id: f.article.id } })).content).toContain('data-poll-id=')
      return 'invalidated'
    })
    await expect(backfillPolls(db!, { apply: true, clientSiteId: f.siteId })).resolves.toMatchObject({
      needed: 1,
      updated: 1,
    })
    const saved = await db!.article.findUniqueOrThrow({ where: { id: f.article.id } })
    expect(saved.content).toContain('data-poll-id=')
    expect(await db!.poll.count({ where: { articleId: f.article.id } })).toBe(1)
    await expect(backfillPolls(db!, { apply: true, clientSiteId: f.siteId })).resolves.toMatchObject({
      needed: 0,
      updated: 0,
    })
    expect((await db!.article.findUniqueOrThrow({ where: { id: f.article.id } })).content).toBe(saved.content)
    expect(invalidateFeed).toHaveBeenCalledTimes(1)
  })

  it('does not overwrite an author edit or create orphan polls during maintenance', async () => {
    const f = await pollFixture()
    vi.mocked(invalidateFeed).mockClear()
    const transaction = db!.$transaction.bind(db)
    const concurrent = {
      article: db!.article,
      $transaction: async (run: Parameters<typeof db.$transaction>[0]) => {
        await db!.article.update({ where: { id: f.article.id }, data: { content: '<p>New author text.</p>' } })
        return transaction(run)
      },
    } as unknown as ReturnType<typeof createDatabaseClient>
    await expect(backfillPolls(concurrent, { apply: true, clientSiteId: f.siteId })).resolves.toMatchObject({
      needed: 1,
      updated: 0,
      conflicted: 1,
    })
    expect((await db!.article.findUniqueOrThrow({ where: { id: f.article.id } })).content).toBe(
      '<p>New author text.</p>',
    )
    expect(await db!.poll.count({ where: { articleId: f.article.id } })).toBe(0)
    expect(invalidateFeed).not.toHaveBeenCalled()
  })

  it('uses readable HTML metrics on creation and updates while preserving explicit caller values', async () => {
    const siteId = randomUUID()
    const userId = randomUUID()
    sites.push(siteId)
    users.push(userId)
    await db!.clientSite.create({ data: { id: siteId, name: `metrics-${siteId}`, domain: `${siteId}.test` } })
    await db!.user.create({ data: { id: userId, username: `metrics-${userId}`, email: `${userId}@example.invalid` } })
    const article = await db!.article.create({
      data: {
        clientSiteId: siteId,
        userId,
        language: 'en',
        slug: randomUUID(),
        title: 'Metrics fixture',
        content: '<p>One</p><p>Two</p>',
      },
    })
    expect(article).toMatchObject({ totalWords: 2, readingTime: 1 })
    const edited = await db!.article.update({
      where: { id: article.id },
      data: { content: '<p>One<br>Two<br>Three</p>' },
    })
    expect(edited).toMatchObject({ totalWords: 3, readingTime: 1 })
    const explicit = await db!.article.create({
      data: {
        clientSiteId: siteId,
        userId,
        language: 'en',
        slug: randomUUID(),
        title: 'Explicit metrics',
        content: '<p>One two three.</p>',
        totalWords: 42,
        readingTime: 7,
      },
    })
    expect(explicit).toMatchObject({ totalWords: 42, readingTime: 7 })
  })

  async function resetFixture() {
    setup()
    vi.stubEnv('AUTH_SECRET', 'local-integration-secret')
    const id = randomUUID()
    users.push(id)
    const email = `${id}@example.invalid`
    await db!.user.create({
      data: { id, username: `audit-${id}`, email, password: 'old-password', emailVerified: true },
    })
    await db!.verification.create({
      data: {
        identifier: passwordResetIdentifier(id),
        value: passwordResetHash('abcdef12'),
        expiresAt: new Date(Date.now() + 60_000),
      },
    })
    await db!.session.create({ data: { token: randomUUID(), userId: id, expiresAt: new Date(Date.now() + 60_000) } })
    vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (body: unknown) => unknown) =>
      parse({ email, code: 'abcdef12', password: 'new-password' }),
    )
    vi.stubGlobal('consumeRateLimit', async () => true)
    vi.stubGlobal('ipKey', () => 'test-ip')
    vi.stubGlobal('getIp', () => '127.0.0.1')
    vi.stubGlobal('logAction', vi.fn())
    const { default: route } = await import('../../server/api/auth/reset.post')
    return { id, run: () => route({} as never) }
  }
  it('allows one of two concurrent reset requests and revokes the old session', async () => {
    const { id, run } = await resetFixture()
    const results = await Promise.allSettled([run(), run()])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(await db!.session.count({ where: { userId: id } })).toBe(0)
    const user = await db!.user.findUniqueOrThrow({ where: { id }, select: { password: true } })
    expect(await argon.verify(user.password!, 'new-password')).toBe(true)
    expect(await db!.verification.count({ where: { identifier: passwordResetIdentifier(id) } })).toBe(0)
  })
  it('rolls password, session and code consumption back together if the audit write fails', async () => {
    const { id, run } = await resetFixture()
    vi.stubGlobal('logAction', async () => {
      throw new Error('synthetic audit failure')
    })
    await expect(run()).rejects.toThrow('synthetic audit failure')
    expect(await db!.session.count({ where: { userId: id } })).toBe(1)
    expect(await db!.verification.count({ where: { identifier: passwordResetIdentifier(id) } })).toBe(1)
    const user = await db!.user.findUniqueOrThrow({ where: { id }, select: { password: true } })
    expect(await argon.verify(user.password!, 'old-password')).toBe(true)
  })
  it('keeps internal article fields out of the selected public payload', async () => {
    setup()
    const id = randomUUID()
    sites.push(id)
    const userId = randomUUID()
    users.push(userId)
    await db!.clientSite.create({ data: { id, name: `audit-${id}`, domain: `${id}.test` } })
    await db!.user.create({ data: { id: userId, username: `audit-${userId}`, email: `${userId}@example.invalid` } })
    const created = await db!.article.create({
      data: {
        userId,
        clientSiteId: id,
        language: 'en',
        slug: 'example',
        title: 'Synthetic article',
        content: '<p>Body</p>',
        status: 'published',
        prompt: 'Private synthetic brief',
        savedAmount: 42,
      },
    })
    const article = await db!.article.findUniqueOrThrow({ where: { id: created.id }, select: articleCardSelect() })
    expect(article).not.toHaveProperty('prompt')
    expect(article).not.toHaveProperty('savedAmount')
    expect(article.user).not.toHaveProperty('email')
    await db!.tenantMembership.create({ data: { userId, clientSiteId: id, role: 'OWNER', scopes: [] } })
    await db!.clientSite.update({ where: { id }, data: { deletedAt: new Date() } })
    vi.stubGlobal('requireUser', async () => ({ id: userId, role: 'admin', clientSiteId: id }))
    await expect(requireTenantMember({} as never)).rejects.toMatchObject({ statusCode: 403 })
  })
  it('publishes once across overlapping scheduler transactions', async () => {
    setup()
    vi.stubGlobal('defineMonitoredTask', (task: unknown) => task)
    const siteId = randomUUID()
    sites.push(siteId)
    const userId = randomUUID()
    users.push(userId)
    await db!.clientSite.create({ data: { id: siteId, name: `audit-${siteId}`, domain: `${siteId}.test` } })
    await db!.user.create({ data: { id: userId, username: `audit-${userId}`, email: `${userId}@example.invalid` } })
    const article = await db!.article.create({
      data: {
        userId,
        clientSiteId: siteId,
        language: 'en',
        slug: 'scheduled',
        title: 'Synthetic scheduled article',
        content: '<p>Body</p>',
        releaseAt: new Date(Date.now() - 1000),
      },
    })
    vi.stubGlobal('evaluateMediaRights', async () => ({ fingerprint: 'a'.repeat(64), counts: { needsAttention: 0 } }))
    vi.stubGlobal('mediaRightsSnapshotItems', () => [])
    vi.stubGlobal('syncArticleTranslationQueue', vi.fn())
    const notify = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    vi.stubGlobal('notifyArticlePublished', notify)
    vi.stubGlobal('logAction', vi.fn())
    vi.stubGlobal('invalidateFeed', vi.fn())
    vi.stubGlobal('enqueueArticleWebhook', vi.fn())
    vi.stubGlobal('announceArticle', vi.fn())
    const { default: task } = await import('../../server/tasks/publish-check')
    const run = () => task.run!({} as never)
    const results = await Promise.all([run(), run()])
    expect(
      results.reduce((sum, result) => sum + Number((result as { result: { count: number } }).result.count), 0),
    ).toBe(1)
    expect(notify).toHaveBeenCalledTimes(1)
    expect((await db!.article.findUniqueOrThrow({ where: { id: article.id } })).status).toBe('published')
  })
})

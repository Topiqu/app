// @vitest-environment node
import argon from 'argon2'
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { appMutationPlugin } from '../../server/utils/prisma'
import { createDatabaseClient } from '../../server/utils/database'
import { articleCardSelect } from '../../server/utils/articleCard'
import { requireTenantMember } from '../../server/utils/tenantMembership'
import { passwordResetHash, passwordResetIdentifier } from '../../server/utils/passwordReset'

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

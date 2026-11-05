// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { PolicyPlugin } from '@zenstackhq/plugin-policy'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { userExportChunks } from '../../../server/utils/userExport'
import { createDatabaseClient } from '../../../server/utils/database'

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url) : null

describe.skipIf(!enabled)('account export access on PostgreSQL', () => {
  const suffix = randomUUID()
  const ownedSiteId = randomUUID()
  const otherSiteId = randomUUID()
  const ownerId = randomUUID()
  const strangerId = randomUUID()
  const ownedArticleId = randomUUID()
  const otherArticleId = randomUUID()
  const ownedMediaId = randomUUID()
  const uploadedElsewhereId = randomUUID()
  const otherMediaId = randomUUID()
  const ownedKnowledgeId = randomUUID()
  const otherKnowledgeId = randomUUID()
  const userIds = [ownerId, strangerId]
  const siteIds = [ownedSiteId, otherSiteId]

  const asUser = (id: string) =>
    db!.$use(new PolicyPlugin()).$setAuth({ id, role: 'reader' as const, clientSiteId: '' })
  const exportFor = async (id: string) => {
    let text = ''
    for await (const chunk of userExportChunks(asUser(id) as never, { id })) text += chunk
    return JSON.parse(text)
  }

  beforeAll(async () => {
    for (const [index, id] of userIds.entries())
      await db!.user.create({ data: { id, username: `${suffix}-${index}`, email: `${id}@example.test` } })
    await db!.clientSite.create({ data: { id: ownedSiteId, name: suffix, domain: `${suffix}.test` } })
    await db!.clientSite.create({ data: { id: otherSiteId, name: `other-${suffix}`, domain: `other-${suffix}.test` } })
    await db!.tenantMembership.create({ data: { clientSiteId: ownedSiteId, userId: ownerId, role: 'OWNER' } })
    await db!.tenantMembership.create({ data: { clientSiteId: otherSiteId, userId: strangerId, role: 'OWNER' } })

    const article = (id: string, clientSiteId: string, userId: string, slug: string) =>
      db!.article.create({
        data: { id, clientSiteId, userId, language: 'cs', slug, title: slug, content: 'Body', status: 'draft' },
      })
    await article(ownedArticleId, ownedSiteId, strangerId, `owned-${suffix}`)
    await article(otherArticleId, otherSiteId, strangerId, `other-${suffix}`)

    const media = (id: string, clientSiteId: string, createdById: string) =>
      db!.mediaAsset.create({ data: { id, clientSiteId, createdById, url: `https://cdn.example.test/${id}` } })
    await media(ownedMediaId, ownedSiteId, strangerId)
    await media(uploadedElsewhereId, otherSiteId, ownerId)
    await media(otherMediaId, otherSiteId, strangerId)

    const knowledge = (id: string, clientSiteId: string, createdById: string) =>
      db!.knowledgeSource.create({
        data: {
          id,
          clientSiteId,
          createdById,
          kind: 'NOTE',
          title: id,
          content: 'Knowledge',
          contentHash: 'a'.repeat(64),
        },
      })
    await knowledge(ownedKnowledgeId, ownedSiteId, strangerId)
    await knowledge(otherKnowledgeId, otherSiteId, strangerId)

    await db!.account.create({
      data: { userId: ownerId, providerId: 'github', accountId: `gh-${suffix}`, accessToken: 'secret-access-token' },
    })
    await db!.account.create({ data: { userId: strangerId, providerId: 'github', accountId: `other-gh-${suffix}` } })
    await db!.articleView.create({
      data: {
        articleId: otherArticleId,
        clientSiteId: otherSiteId,
        userId: ownerId,
        sessionId: `session-${suffix}`,
        viewedOn: new Date(),
      },
    })
    await db!.session.create({
      data: {
        token: `secret-session-${suffix}`,
        userId: ownerId,
        expiresAt: new Date(Date.now() + 60_000),
      },
    })
  })

  afterAll(async () => {
    await db!.knowledgeSource.deleteMany({ where: { clientSiteId: { in: siteIds } } })
    await db!.mediaAsset.deleteMany({ where: { clientSiteId: { in: siteIds } } })
    await db!.article.deleteMany({ where: { clientSiteId: { in: siteIds } } })
    await db!.clientSite.deleteMany({ where: { id: { in: siteIds } } })
    await db!.user.deleteMany({ where: { id: { in: userIds } } })
    await db!.$disconnect()
  })

  it("reads an owner's blog and the user's own records, but nothing from another tenant", async () => {
    const data = await exportFor(ownerId)
    const ids = (rows: { id: string }[]) => rows.map(({ id }) => id).sort()

    expect(ids(data.articles)).toEqual([ownedArticleId])
    expect(data.articles[0].authoredByYou).toBe(false)
    expect(ids(data.media)).toEqual([ownedMediaId, uploadedElsewhereId].sort())
    expect(ids(data.knowledgeSources)).toEqual([ownedKnowledgeId])
    expect(data.connectedAccounts).toEqual([expect.objectContaining({ accountId: `gh-${suffix}` })])
    expect(data.articleViews).toHaveLength(1)
    expect(data.sessions).toHaveLength(1)
  })

  it('does not contain any stored secret', async () => {
    const text = JSON.stringify(await exportFor(ownerId))

    expect(text).not.toContain('secret-access-token')
    expect(text).not.toContain(`secret-session-${suffix}`)
  })

  it("keeps another user's connected accounts unreadable", async () => {
    const rows = await asUser(ownerId).account.findMany({ where: { userId: strangerId } })

    expect(rows).toEqual([])
  })
})

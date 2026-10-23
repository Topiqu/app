// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it, vi } from 'vitest'

import type { DatabaseTransaction } from '../../server/utils/database'

import { createDatabaseClient } from '../../server/utils/database'

vi.mock('../../server/utils/database', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/database')>()
  return {
    ...original,
    createDatabaseClient: (target?: string) => {
      if (!target || target !== process.env.TEST_DATABASE_URL)
        throw new Error('Explicit isolated test database is required')
      return original.createDatabaseClient(target)
    },
  }
})

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url) : null
const sites: string[] = []
const users: string[] = []

afterAll(async () => {
  if (!db) return
  await db.articleMediaUsage.deleteMany({ where: { clientSiteId: { in: sites } } })
  await db.articleTranslation.deleteMany({ where: { clientSiteId: { in: sites } } })
  await db.articleDraft.deleteMany({ where: { clientSiteId: { in: sites } } })
  await db.article.deleteMany({ where: { clientSiteId: { in: sites } } })
  await db.mediaAsset.deleteMany({ where: { clientSiteId: { in: sites } } })
  await db.clientSite.deleteMany({ where: { id: { in: sites } } })
  await db.user.deleteMany({ where: { id: { in: users } } })
  await db.$disconnect()
})

describe.skipIf(!enabled)('bounded media maintenance on PostgreSQL', () => {
  const tenant = async () => {
    const siteId = randomUUID()
    const userId = randomUUID()
    sites.push(siteId)
    users.push(userId)
    await db!.clientSite.create({
      data: { id: siteId, name: `media-maintenance-${siteId}`, domain: `${siteId}.test`, language: 'cs' },
    })
    await db!.user.create({
      data: { id: userId, username: `media-${userId}`, email: `${userId}@example.invalid` },
    })
    return { siteId, userId }
  }

  it('enriches missing search fields while preserving rights and archive state', async () => {
    const { backfillMediaLibrary } = await import('../../scripts/backfill-media-library')
    const { siteId } = await tenant()
    const confirmed = new Date('2026-01-01T00:00:00Z')
    const archived = new Date('2026-01-02T00:00:00Z')
    const purgeAfter = new Date('2026-01-09T00:00:00Z')
    const asset = await db!.mediaAsset.create({
      data: {
        clientSiteId: siteId,
        url: 'https://images.test/licensed.webp',
        origin: 'LICENSED_STOCK',
        author: 'Fixture author',
        license: 'Fixture license',
        sourceUrl: 'https://images.test/original',
        rightsConfirmedAt: confirmed,
        archivedAt: archived,
        purgeAfter,
      },
    })
    await expect(backfillMediaLibrary(db!, { clientSiteId: siteId })).resolves.toMatchObject({ enriched: 1 })
    expect((await db!.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } })).deliveryUrl).toBeNull()
    await expect(backfillMediaLibrary(db!, { apply: true, clientSiteId: siteId })).resolves.toMatchObject({
      enriched: 1,
    })
    expect(await db!.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } })).toMatchObject({
      origin: 'LICENSED_STOCK',
      author: 'Fixture author',
      license: 'Fixture license',
      sourceUrl: 'https://images.test/original',
      rightsConfirmedAt: confirmed,
      archivedAt: archived,
      purgeAfter,
      deliveryUrl: asset.url,
      originalFilename: 'licensed.webp',
    })
  })

  it('indexes source language, translations and drafts with tenant-bound identities and stable reruns', async () => {
    const { backfillMediaLibrary } = await import('../../scripts/backfill-media-library')
    const own = await tenant()
    const other = await tenant()
    const url = `https://images.test/shared-${randomUUID()}.webp`
    const foreign = await db!.mediaAsset.create({ data: { clientSiteId: other.siteId, url, origin: 'OWN' } })
    const article = await db!.article.create({
      data: {
        clientSiteId: own.siteId,
        userId: own.userId,
        language: 'en',
        slug: randomUUID(),
        title: 'Media fixture',
        imageUrl: url,
        coverMediaId: foreign.id,
        content: `<p><img src="${url}"><img src="${url}"></p>`,
      },
    })
    const translation = await db!.articleTranslation.create({
      data: {
        clientSiteId: own.siteId,
        articleId: article.id,
        language: 'fr',
        title: 'Traduction',
        content: `<p><img src="${url}"></p>`,
        status: 'READY',
      },
    })
    const draftUrl = `https://images.test/draft-${randomUUID()}.webp`
    await db!.articleDraft.create({
      data: {
        clientSiteId: own.siteId,
        userId: own.userId,
        title: 'Draft fixture',
        content: `<p><img src="${draftUrl}"></p>`,
      },
    })
    await expect(
      backfillMediaLibrary(db!, { apply: true, clientSiteId: own.siteId, batchSize: 1 }),
    ).resolves.toMatchObject({ created: 2, usages: 3 })
    const usages = await db!.articleMediaUsage.findMany({ where: { articleId: article.id } })
    expect(usages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ language: 'en', placement: 'COVER', occurrenceCount: 1, articleTranslationId: null }),
        expect.objectContaining({ language: 'en', placement: 'BODY', occurrenceCount: 2, articleTranslationId: null }),
        expect.objectContaining({
          language: 'fr',
          placement: 'BODY',
          occurrenceCount: 1,
          articleTranslationId: translation.id,
        }),
      ]),
    )
    expect(usages.every((row) => row.clientSiteId === own.siteId && row.mediaAssetId !== foreign.id)).toBe(true)
    const before = await db!.mediaAsset.count({ where: { clientSiteId: own.siteId } })
    await expect(backfillMediaLibrary(db!, { apply: true, clientSiteId: own.siteId })).resolves.toMatchObject({
      created: 0,
      usages: 3,
    })
    expect(await db!.mediaAsset.count({ where: { clientSiteId: own.siteId } })).toBe(before)
    expect(await db!.articleMediaUsage.count({ where: { articleId: article.id } })).toBe(3)
  })

  it('keeps the prior usage index and rolls back asset creation when replacement fails', async () => {
    const { backfillMediaLibrary } = await import('../../scripts/backfill-media-library')
    const { siteId, userId } = await tenant()
    const prior = await db!.mediaAsset.create({
      data: { clientSiteId: siteId, url: `https://images.test/prior-${randomUUID()}.webp`, origin: 'OWN' },
    })
    const nextUrl = `https://images.test/next-${randomUUID()}.webp`
    const article = await db!.article.create({
      data: {
        clientSiteId: siteId,
        userId,
        language: 'cs',
        slug: randomUUID(),
        title: 'Rollback fixture',
        content: `<p><img src="${nextUrl}"></p>`,
      },
    })
    const usage = await db!.articleMediaUsage.create({
      data: { clientSiteId: siteId, articleId: article.id, mediaAssetId: prior.id, language: 'cs', placement: 'BODY' },
    })
    const failing = new Proxy(db!, {
      get(target, key, receiver) {
        if (key === '$transaction')
          return (run: (tx: DatabaseTransaction) => Promise<unknown>) =>
            target.$transaction(async (tx) =>
              run(
                new Proxy(tx, {
                  get(client, property, original) {
                    if (property === 'articleMediaUsage')
                      return new Proxy(client.articleMediaUsage, {
                        get(model, operation, delegate) {
                          if (operation === 'createMany')
                            return async () => {
                              throw new Error('Injected usage replacement failure')
                            }
                          return Reflect.get(model, operation, delegate)
                        },
                      })
                    return Reflect.get(client, property, original)
                  },
                }),
              ),
            )
        return Reflect.get(target, key, receiver)
      },
    })
    await expect(backfillMediaLibrary(failing, { apply: true, clientSiteId: siteId })).rejects.toThrow(
      'Injected usage replacement failure',
    )
    expect(await db!.articleMediaUsage.findUnique({ where: { id: usage.id } })).not.toBeNull()
    expect(await db!.mediaAsset.count({ where: { clientSiteId: siteId, url: nextUrl } })).toBe(0)
  })
})

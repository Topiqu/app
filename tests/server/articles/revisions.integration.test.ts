// @vitest-environment node
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { PolicyPlugin } from '@zenstackhq/plugin-policy'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SessionUser } from '../../../shared/types/auth'
import type { ArticleUpdateArgs } from '../../../generated/zenstack/input'

import { sanitizeHtml } from '../../../server/utils/sanitize'
import { createDatabaseClient } from '../../../server/utils/database'
import { changesReaderText } from '../../../server/utils/articleModified'
import { articleRevisionSnapshot } from '../../../shared/utils/articleRevision'
import { requireArticleAccess, requireTenantScope } from '../../../server/utils/tenantMembership'

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url) : null
const siteIds: string[] = []
const userIds: string[] = []

afterEach(() => vi.unstubAllGlobals())
afterAll(async () => {
  if (!db) return
  await db.clientSite.deleteMany({ where: { id: { in: siteIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
  await db.$disconnect()
})

describe.skipIf(!enabled)('article version history on PostgreSQL', () => {
  beforeEach(() => {
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('prisma', db)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('consumeRateLimit', async () => true)
    vi.stubGlobal('requireTenantScope', requireTenantScope)
    vi.stubGlobal('requireArticleAccess', requireArticleAccess)
    vi.stubGlobal('sanitizeHtml', sanitizeHtml)
    vi.stubGlobal('setResponseHeader', vi.fn())
  })

  const fixture = async () => {
    const siteId = randomUUID()
    const userId = randomUUID()
    siteIds.push(siteId)
    userIds.push(userId)
    const site = await db!.clientSite.create({
      data: { id: siteId, name: `revision-${siteId}`, domain: `${siteId}.test` },
    })
    const owner = await db!.user.create({
      data: {
        id: userId,
        username: `rev-${userId}`,
        email: `${userId}@example.invalid`,
        role: 'admin',
        clientSiteId: siteId,
      },
    })
    await db!.tenantMembership.create({ data: { userId, clientSiteId: siteId, role: 'OWNER', scopes: [] } })
    const article = await db!.article.create({
      data: {
        userId,
        clientSiteId: siteId,
        language: 'cs',
        slug: 'puvodni-clanek',
        title: 'Původní článek',
        content: '<h2>Žluťoučký kůň</h2><p>Původní text.</p>',
        excerpt: 'Původní perex',
      },
    })
    const user: SessionUser = {
      id: userId,
      name: owner.username,
      email: owner.email,
      role: 'admin',
      clientSiteId: siteId,
      scopes: [],
      sessionId: 'test-session',
      plan: 'BASIC',
      avatarUrl: null,
    }
    const scoped = db!.$use(new PolicyPlugin({ dangerouslyAllowRawSql: true })).$setAuth(user)
    return { site, user, article, scoped }
  }

  const routes = async (f: Awaited<ReturnType<typeof fixture>>) => {
    vi.stubGlobal('requireUser', async () => f.user)
    vi.stubGlobal('getEnhancedPrisma', async () => f.scoped)
    vi.stubGlobal('getRouterParams', () => ({ id: f.article.id }))
    const list = (await import('../../../server/api/articles/[id]/revisions/index.get')).default
    const detail = (await import('../../../server/api/articles/[id]/revisions/[revisionId].get')).default
    return { list, detail }
  }

  const patch = async (f: Awaited<ReturnType<typeof fixture>>, payload: Record<string, unknown>) => {
    vi.stubGlobal('requireUser', async () => f.user)
    vi.stubGlobal('getEnhancedPrisma', async () => f.scoped)
    vi.stubGlobal('getRouterParam', () => f.article.id)
    vi.stubGlobal('readBody', async () => ({ ...payload }))
    vi.stubGlobal('hasTenantScope', () => true)
    vi.stubGlobal('assertTenantMedia', async () => null)
    vi.stubGlobal('isCoverImageUrl', () => true)
    vi.stubGlobal('coverCreditFromMedia', async () => null)
    vi.stubGlobal('requireMediaRightsReview', async () => null)
    vi.stubGlobal('changesReaderText', changesReaderText)
    vi.stubGlobal('applyMediaAttributions', async (_site: string, content: string) => content)
    vi.stubGlobal('stampHeadingIds', (content: string) => content)
    vi.stubGlobal('syncArticlePolls', async (_tx: unknown, _id: string, content: string) => content)
    vi.stubGlobal('syncArticleMediaUsages', vi.fn())
    vi.stubGlobal('syncArticleTranslationQueue', vi.fn())
    vi.stubGlobal('invalidateFeed', vi.fn())
    vi.stubGlobal('logAction', vi.fn())
    vi.stubGlobal('getIp', () => '127.0.0.1')
    vi.stubGlobal('enqueueArticleWebhook', vi.fn())
    vi.stubGlobal('announceArticle', vi.fn())
    vi.stubGlobal('isUniqueViolation', () => false)
    return (await import('../../../server/api/articles/[id]/index.patch')).default
  }

  it('archives the exact previous editable state and increments versions for each changed field', async () => {
    const f = await fixture()
    const media = await db!.mediaAsset.create({
      data: { clientSiteId: f.site.id, url: 'https://media.example.invalid/fixture.jpg' },
    })
    const series = await db!.articleSeries.create({
      data: { clientSiteId: f.site.id, name: 'Fixture series', slug: 'fixture-series' },
    })
    const changes: Array<[string, ArticleUpdateArgs['data']]> = [
      ['title', { title: 'Nový český titulek' }],
      ['excerpt', { excerpt: 'Nový perex' }],
      ['content', { content: '<p>Nový text.</p>' }],
      ['slug', { slug: 'novy-clanek' }],
      ['language', { language: 'en' }],
      ['imageUrl', { imageUrl: 'https://media.example.invalid/cover.jpg' }],
      ['imageCredit', { imageCredit: { kind: 'illustration' } }],
      ['coverMediaId', { coverMediaId: media.id }],
      ['status', { status: 'published' }],
      ['releaseAt', { releaseAt: new Date('2030-01-01T12:00:00Z') }],
      ['allowedComments', { allowedComments: false }],
      ['answer', { answer: 'Nová přímá odpověď.' }],
      ['keyTakeaways', { keyTakeaways: ['Jeden ověřený závěr.'] }],
      ['faq', { faq: [{ question: 'Proč?', answer: 'Protože.' }] }],
      ['sources', { sources: ['https://source.example.invalid/reference'] }],
      ['format', { format: 'GUIDE' }],
      ['structureVariant', { structureVariant: 'comparison' }],
      ['prompt', { prompt: 'Synthetic private brief' }],
      ['articleSeriesId', { articleSeriesId: series.id }],
      ['seriesOrder', { seriesOrder: 2 }],
      ['aiInvolvement', { aiInvolvement: 'ASSIST' }],
    ]
    let previous = f.article
    for (const [field, data] of changes) {
      // The ORM normalizes nullable SQL arrays to []; history must retain the actual pre-change row.
      const [original] = await db!.$queryRaw<Array<{ snapshot: Record<string, unknown> }>>`
        SELECT to_jsonb(article) AS snapshot FROM "Article" AS article WHERE id = ${f.article.id}
      `
      const updated = await db!.article.update({ where: { id: f.article.id }, data })
      expect(updated.editVersion, field).toBe(previous.editVersion + 1)
      const revision = await db!.articleRevision.findUniqueOrThrow({
        where: { articleId_version: { articleId: f.article.id, version: previous.editVersion } },
      })
      expect(revision.snapshot, field).toMatchObject({ [field]: original!.snapshot[field] })
      expect(revision).toMatchObject({ title: previous.title, clientSiteId: f.site.id, actorId: null, actorName: null })
      expect(articleRevisionSnapshot.safeParse(revision.snapshot).success).toBe(true)
      previous = updated
    }
    expect(await db!.articleRevision.count({ where: { articleId: f.article.id } })).toBe(changes.length)
  })

  it('does not invalidate an editor for analytics, bookkeeping timestamps or unchanged content', async () => {
    const f = await fixture()
    await db!.article.update({
      where: { id: f.article.id },
      data: {
        views: { increment: 1 },
        shared: { increment: 1 },
        updatedAt: new Date('2026-10-22'),
        publishedAt: new Date('2026-10-01'),
        contentUpdatedAt: new Date('2026-10-02'),
        readingTime: 5,
        totalWords: 100,
        savedAmount: 2,
        savedTimeMinutes: 10,
      },
    })
    const unchanged = await db!.article.update({
      where: { id: f.article.id },
      data: { title: f.article.title, editVersion: 9999 },
    })
    expect(unchanged.editVersion).toBe(0)
    expect(await db!.articleRevision.count({ where: { articleId: f.article.id } })).toBe(0)
  })

  it('retains only the newest 50 pre-change snapshots of an article', async () => {
    const f = await fixture()
    await db!.$transaction(async (tx) => {
      for (let index = 1; index <= 55; index++)
        await tx.article.update({ where: { id: f.article.id }, data: { title: `Revision ${index}` } })
    })
    const revisions = await db!.articleRevision.findMany({
      where: { articleId: f.article.id },
      orderBy: { version: 'asc' },
      select: { version: true },
    })
    expect(revisions.map((revision) => revision.version)).toEqual(Array.from({ length: 50 }, (_, index) => index + 5))
    expect((await db!.article.findUniqueOrThrow({ where: { id: f.article.id } })).editVersion).toBe(55)
  })

  it('rolls back the article, version and archived snapshot with its transaction', async () => {
    const f = await fixture()
    await expect(
      db!.$transaction(async (tx) => {
        await tx.article.update({ where: { id: f.article.id }, data: { title: 'Must roll back' } })
        expect(await tx.articleRevision.count({ where: { articleId: f.article.id } })).toBe(1)
        throw new Error('Synthetic transaction failure')
      }),
    ).rejects.toThrow('Synthetic transaction failure')
    expect(await db!.article.findUniqueOrThrow({ where: { id: f.article.id } })).toMatchObject({
      title: f.article.title,
      editVersion: 0,
    })
    expect(await db!.articleRevision.count({ where: { articleId: f.article.id } })).toBe(0)
  })

  it('keeps transaction-local actor attribution out of concurrent and later system edits', async () => {
    const f = await fixture()
    const other = await fixture()
    let signalReady!: () => void
    let release!: () => void
    const ready = new Promise<void>((resolve) => {
      signalReady = resolve
    })
    const resume = new Promise<void>((resolve) => {
      release = resolve
    })
    const attributed = db!.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('topiqu.actor_id', ${f.user.id}, true), set_config('topiqu.actor_name', ${f.user.name}, true)`
      signalReady()
      await resume
      await tx.article.update({ where: { id: f.article.id }, data: { title: 'Attributed edit' } })
    })
    try {
      await ready
      await db!.article.update({ where: { id: other.article.id }, data: { title: 'Concurrent system edit' } })
    } finally {
      release()
    }
    await attributed
    await db!.article.update({ where: { id: f.article.id }, data: { title: 'Later system edit' } })
    const own = await db!.articleRevision.findMany({ where: { articleId: f.article.id }, orderBy: { version: 'asc' } })
    const foreign = await db!.articleRevision.findFirstOrThrow({ where: { articleId: other.article.id } })
    expect(own[0]).toMatchObject({ actorId: f.user.id, actorName: f.user.name })
    expect(own[1]).toMatchObject({ actorId: null, actorName: null })
    expect(foreign).toMatchObject({ actorId: null, actorName: null })
  })

  it('allows exactly one actual PATCH when two editors save the same observed version', async () => {
    const f = await fixture()
    const oldTag = await db!.tag.create({ data: { clientSiteId: f.site.id, name: 'Original', slug: 'original' } })
    const newTag = await db!.tag.create({ data: { clientSiteId: f.site.id, name: 'Changed', slug: 'changed' } })
    await db!.articleTag.create({ data: { articleId: f.article.id, tagId: oldTag.id } })
    const handler = await patch(f, { title: 'First writer wins', tagIds: [newTag.id], expectedVersion: 0 })
    let waiting = 0
    let open!: () => void
    const bothRead = new Promise<void>((resolve) => {
      open = resolve
    })
    const racing = {
      article: {
        findUnique: async (args: Parameters<typeof f.scoped.article.findUnique>[0]) => {
          const previous = await f.scoped.article.findUnique(args)
          if (++waiting === 2) open()
          await bothRead
          return previous
        },
      },
      $transaction: f.scoped.$transaction.bind(f.scoped),
    }
    vi.stubGlobal('getEnhancedPrisma', async () => racing)
    const results = await Promise.allSettled([handler({} as never), handler({} as never)])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason).toMatchObject({ statusCode: 409, data: { code: 'ARTICLE_EDIT_CONFLICT' } })
    expect(await db!.article.findUniqueOrThrow({ where: { id: f.article.id } })).toMatchObject({
      title: 'First writer wins',
      editVersion: 1,
    })
    expect(await db!.articleRevision.count({ where: { articleId: f.article.id } })).toBe(1)
    const revision = await db!.articleRevision.findFirstOrThrow({ where: { articleId: f.article.id } })
    expect(revision.snapshot).toMatchObject({ tagIds: [oldTag.id] })
    expect(await db!.articleTag.findMany({ where: { articleId: f.article.id }, select: { tagId: true } })).toEqual([
      { tagId: newTag.id },
    ])
  })

  it('rolls back tag-only changes, forced version increments and snapshots if the save transaction fails', async () => {
    const f = await fixture()
    const oldTag = await db!.tag.create({ data: { clientSiteId: f.site.id, name: 'Before', slug: 'before' } })
    const newTag = await db!.tag.create({ data: { clientSiteId: f.site.id, name: 'After', slug: 'after' } })
    await db!.articleTag.create({ data: { articleId: f.article.id, tagId: oldTag.id } })
    const handler = await patch(f, { tagIds: [newTag.id], expectedVersion: 0 })
    vi.stubGlobal('getEnhancedPrisma', async () => ({
      article: f.scoped.article,
      $transaction: (run: (tx: unknown) => Promise<unknown>) =>
        f.scoped.$transaction(async (tx) => {
          await run(tx)
          expect(await tx.articleRevision.count({ where: { articleId: f.article.id } })).toBe(1)
          throw new Error('Synthetic commit failure')
        }),
    }))
    await expect(handler({} as never)).rejects.toThrow('Synthetic commit failure')
    expect((await db!.article.findUniqueOrThrow({ where: { id: f.article.id } })).editVersion).toBe(0)
    expect(await db!.articleRevision.count({ where: { articleId: f.article.id } })).toBe(0)
    expect(await db!.articleTag.findMany({ where: { articleId: f.article.id }, select: { tagId: true } })).toEqual([
      { tagId: oldTag.id },
    ])
  })

  it('allows only one translation update for an observed timestamp on the actual database', async () => {
    const f = await fixture()
    const translation = await db!.articleTranslation.create({
      data: {
        articleId: f.article.id,
        clientSiteId: f.site.id,
        language: 'en',
        slug: 'translation-fixture',
        title: 'Initial translation',
        content: '<p>Initial body</p>',
        status: 'READY',
        updatedAt: new Date('2026-10-01T12:00:00Z'),
      },
    })
    await patch(f, {})
    vi.stubGlobal('getRouterParam', () => translation.id)
    vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (value: unknown) => unknown) =>
      parse({ title: 'Changed translation', expectedUpdatedAt: translation.updatedAt.toISOString() }),
    )
    let waiting = 0
    let open!: () => void
    const bothRead = new Promise<void>((resolve) => {
      open = resolve
    })
    const racing = {
      articleTranslation: {
        findFirst: async (args: Parameters<typeof f.scoped.articleTranslation.findFirst>[0]) => {
          const previous = await f.scoped.articleTranslation.findFirst(args)
          if (++waiting === 2) open()
          await bothRead
          return previous
        },
      },
      $transaction: f.scoped.$transaction.bind(f.scoped),
    }
    vi.stubGlobal('requireDb', async () => ({ user: f.user, db: racing }))
    const media = vi.fn()
    vi.stubGlobal('syncArticleMediaUsages', media)
    const handler = (await import('../../../server/api/translations/[id]/index.patch')).default
    const results = await Promise.allSettled([handler({} as never), handler({} as never)])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason).toMatchObject({ statusCode: 409 })
    const updated = await db!.articleTranslation.findUniqueOrThrow({ where: { id: translation.id } })
    expect(updated).toMatchObject({ title: 'Changed translation', source: 'HUMAN' })
    expect(updated.updatedAt.getTime()).toBeGreaterThan(translation.updatedAt.getTime())
    expect(media).toHaveBeenCalledTimes(1)
    expect(await db!.articleRevision.count({ where: { articleId: f.article.id } })).toBe(0)
  })

  it('rolls back poll mutations when the PATCH transaction fails before saving content', async () => {
    const f = await fixture()
    const handler = await patch(f, { content: '<p>Poll edit</p>', expectedVersion: 0 })
    vi.stubGlobal('syncArticlePolls', async (tx: typeof db, id: string) => {
      await tx!.poll.create({ data: { articleId: id, question: 'Synthetic poll' } })
      throw new Error('Synthetic reconciliation failure')
    })
    await expect(handler({} as never)).rejects.toThrow('Synthetic reconciliation failure')
    expect(await db!.poll.count({ where: { articleId: f.article.id } })).toBe(0)
    expect(await db!.article.findUniqueOrThrow({ where: { id: f.article.id } })).toMatchObject({
      content: f.article.content,
      editVersion: 0,
    })
    expect(await db!.articleRevision.count({ where: { articleId: f.article.id } })).toBe(0)
  })

  it('versions standalone tag POST, DELETE and PUT changes and rejects the editor draft they made stale', async () => {
    const f = await fixture()
    const [original, added, replacement] = await Promise.all([
      db!.tag.create({ data: { clientSiteId: f.site.id, name: 'Original', slug: 'original' } }),
      db!.tag.create({ data: { clientSiteId: f.site.id, name: 'Added', slug: 'added' } }),
      db!.tag.create({ data: { clientSiteId: f.site.id, name: 'Replacement', slug: 'replacement' } }),
    ])
    await db!.articleTag.create({ data: { articleId: f.article.id, tagId: original.id } })
    vi.stubGlobal('requireUser', async () => f.user)
    vi.stubGlobal('requireDb', async () => ({ user: f.user, db: f.scoped }))
    vi.stubGlobal('getEnhancedPrisma', async () => f.scoped)
    vi.stubGlobal('getRouterParam', () => f.article.id)
    const invalidate = vi.fn()
    vi.stubGlobal('invalidateFeed', invalidate)
    let body: Record<string, unknown> = { tagId: added.id }
    vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (value: unknown) => unknown) => parse(body))
    const post = (await import('../../../server/api/articles/[id]/tags/index.post')).default
    const remove = (await import('../../../server/api/articles/[id]/tags/[tagId]/index.delete')).default
    const put = (await import('../../../server/api/articles/[id]/tags/index.put')).default
    const event = { context: { params: { id: f.article.id, tagId: original.id } } } as never
    const expectState = async (version: number, tagIds: string[], previousTagIds: string[]) => {
      expect((await db!.article.findUniqueOrThrow({ where: { id: f.article.id } })).editVersion).toBe(version)
      const revision = await db!.articleRevision.findUniqueOrThrow({
        where: { articleId_version: { articleId: f.article.id, version: version - 1 } },
      })
      expect(articleRevisionSnapshot.parse(revision.snapshot).tagIds.sort()).toEqual([...previousTagIds].sort())
      expect(revision).toMatchObject({ actorId: f.user.id, actorName: f.user.name })
      const current = await db!.articleTag.findMany({ where: { articleId: f.article.id }, select: { tagId: true } })
      expect(current.map((tag) => tag.tagId).sort()).toEqual([...tagIds].sort())
    }
    await expect(post(event)).resolves.toEqual({ success: true })
    await expectState(1, [original.id, added.id], [original.id])
    await expect(remove(event)).resolves.toEqual({ success: true })
    await expectState(2, [added.id], [original.id, added.id])
    body = { tagIds: [replacement.id] }
    await expect(put(event)).resolves.toEqual({ success: true })
    await expectState(3, [replacement.id], [added.id])
    expect(invalidate).toHaveBeenCalledTimes(3)
    expect(await db!.articleRevision.count({ where: { articleId: f.article.id } })).toBe(3)
    const saveStaleDraft = await patch(f, { title: 'Stale editor draft', tagIds: [original.id], expectedVersion: 0 })
    await expect(saveStaleDraft({} as never)).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'ARTICLE_EDIT_CONFLICT' },
    })
    await expectState(3, [replacement.id], [added.id])
    expect((await db!.article.findUniqueOrThrow({ where: { id: f.article.id } })).title).toBe(f.article.title)
  })

  it.each(['POST', 'DELETE', 'PUT'] as const)(
    'rolls back the tag join, version and revision when standalone %s fails',
    async (method) => {
      const f = await fixture()
      const original = await db!.tag.create({ data: { clientSiteId: f.site.id, name: 'Original', slug: 'original' } })
      const other = await db!.tag.create({ data: { clientSiteId: f.site.id, name: 'Other', slug: 'other' } })
      await db!.articleTag.create({ data: { articleId: f.article.id, tagId: original.id } })
      vi.stubGlobal('requireUser', async () => f.user)
      vi.stubGlobal('requireDb', async () => ({ user: f.user, db: f.scoped }))
      vi.stubGlobal('getRouterParam', () => f.article.id)
      const invalidate = vi.fn()
      vi.stubGlobal('invalidateFeed', invalidate)
      const body = method === 'PUT' ? { tagIds: [other.id] } : { tagId: original.id }
      vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (value: unknown) => unknown) => parse(body))
      vi.stubGlobal('getEnhancedPrisma', async () => {
        // Reproduce a tag disappearing after PUT validates it but before the join insert.
        if (method === 'PUT') await db!.tag.delete({ where: { id: other.id } })
        return f.scoped
      })
      const handler =
        method === 'POST'
          ? (await import('../../../server/api/articles/[id]/tags/index.post')).default
          : method === 'DELETE'
            ? (await import('../../../server/api/articles/[id]/tags/[tagId]/index.delete')).default
            : (await import('../../../server/api/articles/[id]/tags/index.put')).default
      // POST duplicates an existing join; DELETE targets a valid tenant tag with no join.
      const event = { context: { params: { id: f.article.id, tagId: other.id } } } as never
      await expect(handler(event)).rejects.toThrow()
      expect((await db!.article.findUniqueOrThrow({ where: { id: f.article.id } })).editVersion).toBe(0)
      expect(await db!.articleRevision.count({ where: { articleId: f.article.id } })).toBe(0)
      expect(await db!.articleTag.findMany({ where: { articleId: f.article.id }, select: { tagId: true } })).toEqual([
        { tagId: original.id },
      ])
      expect(invalidate).not.toHaveBeenCalled()
    },
  )

  it('preserves real history and the edit version across repeated identical tag replacements', async () => {
    const f = await fixture()
    const [first, second] = await Promise.all([
      db!.tag.create({ data: { clientSiteId: f.site.id, name: 'First', slug: 'first' } }),
      db!.tag.create({ data: { clientSiteId: f.site.id, name: 'Second', slug: 'second' } }),
    ])
    await db!.articleTag.createMany({
      data: [first, second].map((tag) => ({ articleId: f.article.id, tagId: tag.id })),
    })
    await db!.article.update({ where: { id: f.article.id }, data: { title: 'A genuine saved edit' } })
    const revision = await db!.articleRevision.findFirstOrThrow({ where: { articleId: f.article.id } })
    vi.stubGlobal('requireUser', async () => f.user)
    vi.stubGlobal('getEnhancedPrisma', async () => f.scoped)
    vi.stubGlobal('getRouterParam', () => f.article.id)
    vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (value: unknown) => unknown) =>
      parse({ tagIds: [second.id, first.id, first.id] }),
    )
    const invalidate = vi.fn()
    vi.stubGlobal('invalidateFeed', invalidate)
    const put = (await import('../../../server/api/articles/[id]/tags/index.put')).default
    // Reordering or repeating IDs is the same tag set and must not exhaust the 50-revision limit.
    for (let index = 0; index < 55; index++) await expect(put({} as never)).resolves.toEqual({ success: true })
    expect((await db!.article.findUniqueOrThrow({ where: { id: f.article.id } })).editVersion).toBe(1)
    expect(await db!.articleRevision.findMany({ where: { articleId: f.article.id } })).toEqual([revision])
    const current = await db!.articleTag.findMany({ where: { articleId: f.article.id }, select: { tagId: true } })
    expect(current.map((tag) => tag.tagId).sort()).toEqual([first.id, second.id].sort())
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('returns safe history DTOs to the owner and blocks another tenant through access checks and policies', async () => {
    const own = await fixture()
    const foreign = await fixture()
    await db!.article.update({
      where: { id: own.article.id },
      data: { content: '<script>unsafe()</script><p onclick="unsafe()">Archived text</p>' },
    })
    await db!.article.update({ where: { id: own.article.id }, data: { title: 'Current title' } })
    await db!.article.update({ where: { id: foreign.article.id }, data: { title: 'Foreign edit' } })
    const { list, detail } = await routes(own)
    const summaries = await list({} as never)
    expect(summaries).toHaveLength(2)
    expect(Object.keys(summaries[0]!).sort()).toEqual(['actorName', 'createdAt', 'id', 'title', 'version'])
    vi.stubGlobal('getRouterParams', () => ({ id: own.article.id, revisionId: summaries[0]!.id }))
    const restored = await detail({} as never)
    expect(restored.content).toContain('Archived text')
    expect(restored.content).not.toMatch(/script|onclick=/)
    expect(restored).not.toHaveProperty('slug')
    expect(restored).not.toHaveProperty('status')
    expect(restored).not.toHaveProperty('actorId')
    vi.stubGlobal('getRouterParams', () => ({ id: foreign.article.id, revisionId: summaries[0]!.id }))
    await expect(list({} as never)).rejects.toMatchObject({ statusCode: 403 })
    await expect(detail({} as never)).rejects.toMatchObject({ statusCode: 403 })
    expect(await own.scoped.articleRevision.findMany({ where: { articleId: foreign.article.id } })).toEqual([])
    await expect(
      own.scoped.articleRevision.create({
        data: {
          articleId: own.article.id,
          clientSiteId: own.site.id,
          version: 99,
          title: 'Forged revision',
          snapshot: {},
        },
      }),
    ).rejects.toThrow()
  })
})

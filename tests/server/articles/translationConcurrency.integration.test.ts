// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { createDatabaseClient } from '../../../server/utils/database'
import { activeFeatureFilter } from '../../../server/utils/planFeatures'
import { syncArticleTranslationQueue } from '../../../server/utils/ai/translationQueue'

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
    data: {
      id: clientSiteId,
      name: `translation-${clientSiteId}`,
      domain: `${clientSiteId}.test`,
      language: 'en',
      plan: 'PRO',
      translationMode: 'AUTO',
      translationLanguages: ['fr'],
      publishToWeb: true,
    },
  })
  await db!.user.create({ data: { id: userId, email: `${userId}@example.invalid`, username: `translation-${userId}` } })
  const feature = await db!.feature.upsert({
    where: { code: 'AI' },
    create: { code: 'AI', name: 'AI', priceMonthly: 0 },
    update: {},
  })
  await db!.clientFeature.create({
    data: { clientSiteId, featureId: feature.id, isActive: true, billingLockedUntil: new Date() },
  })
  const article = await db!.article.create({
    data: {
      clientSiteId,
      userId,
      slug: randomUUID(),
      language: 'en',
      title: 'Source article',
      content: '<p>Source text.</p>',
      status: 'published',
    },
  })
  const translation = await db!.articleTranslation.create({
    data: {
      articleId: article.id,
      clientSiteId,
      language: 'fr',
      status: 'PENDING',
      content: '<p>Previous translation.</p>',
    },
  })
  const delegate = db!.articleTranslation
  const isolated = {
    articleTranslation: {
      findMany: (args: Parameters<typeof delegate.findMany>[0]) =>
        delegate.findMany({ ...args, where: { AND: [args?.where ?? {}, { clientSiteId }] } }),
      findUnique: delegate.findUnique.bind(delegate),
      updateMany: (args: Parameters<typeof delegate.updateMany>[0]) =>
        delegate.updateMany({ ...args, where: { AND: [args.where ?? {}, { clientSiteId }] } }),
      count: (args: Parameters<typeof delegate.count>[0]) =>
        delegate.count({ ...args, where: { AND: [args?.where ?? {}, { clientSiteId }] } }),
    },
    $transaction: db!.$transaction.bind(db),
  }
  const output = {
    title: 'French title',
    excerpt: null,
    content: '<p>French content.</p>',
    answer: null,
    keyTakeaways: [],
    faq: [],
    slug: 'french-title',
    usage: { totalTokens: 10 },
  }
  const generate = vi.fn(async () => output)
  vi.stubGlobal('prisma', isolated)
  vi.stubGlobal('defineMonitoredTask', (task: unknown) => task)
  vi.stubGlobal('activeFeatureFilter', activeFeatureFilter)
  vi.stubGlobal('generateTranslation', generate)
  vi.stubGlobal('recordAiUsage', vi.fn().mockResolvedValue(undefined))
  vi.stubGlobal('dedupeTranslationSlug', async () => randomUUID())
  vi.stubGlobal('sanitizeHtml', (html: string) => html)
  vi.stubGlobal('aiModelId', () => 'offline-test')
  vi.stubGlobal('toDatabaseJson', (value: unknown) => value)
  vi.stubGlobal('syncArticleMediaUsages', vi.fn())
  vi.stubGlobal('invalidateFeed', vi.fn())
  vi.stubGlobal('logAction', vi.fn().mockResolvedValue(undefined))
  vi.stubGlobal('announceArticle', vi.fn())
  vi.stubGlobal('reportCaughtError', vi.fn())
  const task = (await import('../../../server/tasks/translate-pending')).default as {
    run: () => Promise<{ result: { processed: number; skipped: number } }>
  }
  return {
    clientSiteId,
    article,
    translation,
    generate,
    output,
    run: () => task.run(),
    current: () => db!.articleTranslation.findUniqueOrThrow({ where: { id: translation.id } }),
  }
}

describe.skipIf(!enabled)('translation claims and source conflicts on PostgreSQL', () => {
  it('does not publish stale source text after a real article edit', async () => {
    const f = await fixture()
    f.generate.mockImplementationOnce(async () => {
      await db!.article.update({ where: { id: f.article.id }, data: { content: '<p>New source text.</p>' } })
      return f.output
    })
    const result = await f.run()
    expect(result.result).toMatchObject({ processed: 0, skipped: 1 })
    expect(await f.current()).toMatchObject({ status: 'STALE', content: '<p>Previous translation.</p>' })
  })

  it('lets only one overlapping worker call the provider', async () => {
    const f = await fixture()
    let entered!: () => void
    let release!: () => void
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    f.generate.mockImplementationOnce(async () => {
      entered()
      await held
      return f.output
    })
    const first = f.run()
    try {
      await started
      await f.run()
      expect(f.generate).toHaveBeenCalledTimes(1)
    } finally {
      release()
    }
    await first
    expect(await f.current()).toMatchObject({ status: 'PUBLISHED', content: f.output.content })
  })

  it('preserves a human save during remote translation', async () => {
    const f = await fixture()
    f.generate.mockImplementationOnce(async () => {
      await db!.articleTranslation.update({
        where: { id: f.translation.id },
        data: { content: '<p>Human text.</p>', status: 'READY', source: 'HUMAN' },
      })
      return f.output
    })
    const result = await f.run()
    expect(result.result).toMatchObject({ processed: 0, skipped: 1 })
    expect(await f.current()).toMatchObject({ status: 'READY', content: '<p>Human text.</p>', source: 'HUMAN' })
  })

  it('advances the token when queued content invalidates an in-flight claim', async () => {
    const f = await fixture()
    const future = new Date('2090-01-01T00:00:00Z')
    await db!.articleTranslation.updateMany({
      where: { id: f.translation.id },
      data: { status: 'TRANSLATING', updatedAt: future },
    })
    await syncArticleTranslationQueue(db!, f.article.id, f.clientSiteId, { contentChanged: true })
    const row = await f.current()
    expect(row.status).toBe('STALE')
    expect(row.updatedAt!.getTime()).toBe(future.getTime() + 1)
  })
})

// @vitest-environment node
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { PolicyPlugin } from '@zenstackhq/plugin-policy'
import { afterAll, beforeAll, describe, expect, it, vi, beforeEach } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/keywords/serp'), 'serpSignals')
  await stubNitroImports(import('../../../server/utils/keywords/dataforseo'), 'dataForSeo', 'hasDataForSeo')
  await stubNitroImports(import('../../../server/utils/ai/reasoning'), 'aiReasoning')
  await stubNitroImports(import('../../../server/utils/planFeatures'), 'activeFeatureFilter')
  await stubNitroImports(import('../../../server/utils/keywords/rank'), 'blogPosition', 'isArticleUrl')
  await stubNitroImports(import('../../../server/utils/ai/researchEvidence'), 'researchTopic')
}

await stubImports()

const { createDatabaseClient } = await import('../../../server/utils/database')
const { calculateArticleMetrics } = await import('../../../server/utils/metrics')
const { creditArticleCredits, getArticleCreditWallet, reserveArticleCredit, settleArticleCredit } =
  await import('../../../server/utils/articleCreditWallet')
const { applyContentAction, articleHash, queueContentAction, refreshAllowance, rollbackContentAction, suggestRefresh } =
  await import('../../../server/utils/keywords/refresh')

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url) : null

describe.skipIf(!enabled)('article updates on PostgreSQL', () => {
  beforeAll(() => {
    vi.stubGlobal('prisma', db)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('reserveArticleCredit', reserveArticleCredit)
    vi.stubGlobal('settleArticleCredit', settleArticleCredit)
    vi.stubGlobal('calculateArticleMetrics', calculateArticleMetrics)
    vi.stubGlobal('syncArticleTranslationQueue', vi.fn().mockResolvedValue(undefined))
    vi.stubGlobal('invalidateFeed', vi.fn().mockResolvedValue(undefined))
    vi.stubGlobal('enqueueArticleWebhook', vi.fn().mockResolvedValue(undefined))
    vi.stubGlobal('logAction', vi.fn().mockResolvedValue(undefined))
    vi.stubGlobal('announceArticle', vi.fn().mockResolvedValue(undefined))
  })
  afterAll(async () => {
    await db?.$disconnect()
    vi.unstubAllGlobals()
  })

  const tenant = async (credits = 20) => {
    const id = randomUUID()
    const site = await db!.clientSite.create({
      data: { id, name: `refresh-${id}`, domain: `${id}.test`, plan: 'PREMIUM' },
    })
    const user = await db!.user.create({
      data: { username: `refresh-${id}`, email: `${id}@example.test`, clientSiteId: id, role: 'admin' },
    })
    const article = await db!.article.create({
      data: {
        clientSiteId: id,
        userId: user.id,
        language: 'cs',
        slug: 'coffee',
        title: 'Původní titulek',
        excerpt: 'Původní perex',
        content: '<h2>Káva</h2><p>Původní postup přípravy.</p>',
        status: 'published',
        publishedAt: new Date('2026-08-01'),
      },
    })
    const scoped = db!
      .$use(new PolicyPlugin({ dangerouslyAllowRawSql: true }))
      .$setAuth({ id: user.id, role: 'admin', clientSiteId: id })
    await creditArticleCredits({
      clientSiteId: id,
      amount: credits,
      source: 'ADMIN',
      reason: 'refresh tests',
      idempotencyKey: randomUUID(),
    })
    const suggestion = await db!.contentAction.create({
      data: { clientSiteId: id, articleId: article.id, keyword: 'káva doma', type: 'REFRESH' },
    })
    return { site, user, article, scoped, suggestion }
  }

  it('serializes two preparations of one action and leaves exactly one credit reserved', async () => {
    const t = await tenant()
    const results = await Promise.allSettled([
      queueContentAction(t.scoped, t.suggestion, 'PREMIUM', new Date(Date.now())),
      queueContentAction(t.scoped, t.suggestion, 'PREMIUM', new Date(Date.now() + 1)),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(await getArticleCreditWallet(t.site.id)).toMatchObject({ balance: 20, reserved: 1, available: 19 })
    expect(await db!.contentAction.findUnique({ where: { id: t.suggestion.id } })).toMatchObject({ status: 'QUEUED' })
  })

  it('enforces the last monthly slot across two different actions', async () => {
    const t = await tenant()
    await db!.contentAction.createMany({
      data: Array.from({ length: refreshAllowance('PREMIUM').monthly - 1 }, (_, i) => ({
        clientSiteId: t.site.id,
        articleId: t.article.id,
        keyword: `done ${i}`,
        type: 'REFRESH',
        status: 'READY',
        creditOperationId: `past-${i}`,
        queuedAt: new Date(),
      })),
    })
    const other = await db!.contentAction.create({
      data: { clientSiteId: t.site.id, articleId: t.article.id, keyword: 'jiný dotaz', type: 'EXPAND' },
    })
    const results = await Promise.allSettled([
      queueContentAction(t.scoped, t.suggestion, 'PREMIUM'),
      queueContentAction(t.scoped, other, 'PREMIUM'),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(await getArticleCreditWallet(t.site.id)).toMatchObject({ balance: 20, reserved: 1 })
  })

  it('blocks a foreign action through the actual policy and returns the losing reservation', async () => {
    const own = await tenant()
    const foreign = await tenant()
    await expect(queueContentAction(own.scoped, foreign.suggestion, 'PREMIUM')).rejects.toThrow()
    expect(await getArticleCreditWallet(foreign.site.id)).toMatchObject({ balance: 20, reserved: 0 })
    expect(await db!.contentAction.findUnique({ where: { id: foreign.suggestion.id } })).toMatchObject({
      status: 'SUGGESTED',
    })
  })

  it('applies a prepared edit once, retains the original snapshot and rolls back once', async () => {
    const t = await tenant()
    const proposal = {
      title: 'Lepší titulek',
      excerpt: 'Lepší perex',
      content: '<h2>Káva</h2><p>Ověřený postup přípravy kávy.</p>',
      baseHash: articleHash(t.article),
    }
    const ready = await db!.contentAction.update({
      where: { id: t.suggestion.id },
      data: { status: 'READY', proposal },
    })
    const results = await Promise.allSettled([
      applyContentAction(t.scoped, ready, t.user.id),
      applyContentAction(t.scoped, ready, t.user.id),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const applied = await db!.contentAction.findUniqueOrThrow({ where: { id: ready.id } })
    expect(applied).toMatchObject({
      status: 'APPLIED',
      snapshot: { title: t.article.title, excerpt: t.article.excerpt, content: t.article.content },
    })
    expect(await db!.article.findUnique({ where: { id: t.article.id } })).toMatchObject({
      title: proposal.title,
      content: proposal.content,
    })
    await rollbackContentAction(t.scoped, applied, t.user.id)
    expect(await db!.article.findUnique({ where: { id: t.article.id } })).toMatchObject({
      title: t.article.title,
      excerpt: t.article.excerpt,
      content: t.article.content,
    })
    await expect(rollbackContentAction(t.scoped, applied, t.user.id)).rejects.toThrow()
  })

  it('preserves a manually changed excerpt and leaves the action ready', async () => {
    const t = await tenant()
    const ready = await db!.contentAction.update({
      where: { id: t.suggestion.id },
      data: {
        status: 'READY',
        proposal: {
          title: t.article.title,
          excerpt: t.article.excerpt,
          content: 'Updated body',
          baseHash: articleHash(t.article),
        },
      },
    })
    await db!.article.update({ where: { id: t.article.id }, data: { excerpt: 'Ručně změněný perex' } })
    await expect(applyContentAction(t.scoped, ready, t.user.id)).rejects.toMatchObject({ statusCode: 409 })
    expect(await db!.contentAction.findUnique({ where: { id: ready.id } })).toMatchObject({ status: 'READY' })
    expect(await db!.article.findUnique({ where: { id: t.article.id } })).toMatchObject({
      excerpt: 'Ručně změněný perex',
    })
  })

  it('rolls back the action transition if the article changes between the read and write', async () => {
    const t = await tenant()
    const ready = await db!.contentAction.update({
      where: { id: t.suggestion.id },
      data: {
        status: 'READY',
        proposal: {
          title: 'Proposed title',
          excerpt: t.article.excerpt,
          content: 'Updated body',
          baseHash: articleHash(t.article),
        },
      },
    })
    const racing = new Proxy(t.scoped, {
      get(target, key) {
        if (key === '$transaction')
          return async (...args: Parameters<typeof target.$transaction>) => {
            await db!.article.update({ where: { id: t.article.id }, data: { title: 'Manual title' } })
            return target.$transaction(...args)
          }
        return Reflect.get(target, key)
      },
    })
    await expect(applyContentAction(racing, ready, t.user.id)).rejects.toMatchObject({ statusCode: 409 })
    expect(await db!.contentAction.findUnique({ where: { id: ready.id } })).toMatchObject({
      status: 'READY',
      snapshot: null,
    })
    expect(await db!.article.findUnique({ where: { id: t.article.id } })).toMatchObject({
      title: 'Manual title',
      content: t.article.content,
    })
  })

  it('allows the explicitly supported superadmin role through the article policy', async () => {
    const t = await tenant()
    const ready = await db!.contentAction.update({
      where: { id: t.suggestion.id },
      data: {
        status: 'READY',
        proposal: {
          title: 'Superadmin update',
          excerpt: t.article.excerpt,
          content: 'Updated body',
          baseHash: articleHash(t.article),
        },
      },
    })
    const superDb = db!
      .$use(new PolicyPlugin({ dangerouslyAllowRawSql: true }))
      .$setAuth({ id: randomUUID(), role: 'superadmin', clientSiteId: t.site.id })
    await applyContentAction(superDb, ready, t.user.id)
    expect(await db!.article.findUnique({ where: { id: t.article.id } })).toMatchObject({ title: 'Superadmin update' })
  })

  it('keeps an old suggestion quiet for 60 days after the editor finally applies it', async () => {
    const t = await tenant()
    const now = new Date()
    await db!.contentAction.update({
      where: { id: t.suggestion.id },
      data: { status: 'APPLIED', createdAt: new Date(now.getTime() - 70 * 86_400_000), appliedAt: now },
    })
    await expect(
      suggestRefresh(
        { id: randomUUID(), clientSiteId: t.site.id, articleId: t.article.id, keyword: 'káva doma' },
        [12, 12],
        t.article.publishedAt,
        now,
      ),
    ).resolves.toBeNull()
    expect(await db!.contentAction.count({ where: { articleId: t.article.id } })).toBe(1)
  })

  it('rolls back credit settlement when the surrounding proposal transaction fails', async () => {
    const t = await tenant(1)
    const reservation = await reserveArticleCredit(t.site.id, 'CONTENT_REFRESH')
    await expect(
      db!.$transaction(async (tx) => {
        await settleArticleCredit(reservation, true, {}, tx)
        throw new Error('proposal write failed')
      }),
    ).rejects.toThrow('proposal write failed')
    expect(await getArticleCreditWallet(t.site.id)).toMatchObject({ balance: 1, reserved: 1 })
    expect(await db!.articleCreditOperation.findUnique({ where: { id: reservation.id } })).toMatchObject({
      status: 'RESERVED',
    })
  })
})

beforeEach(stubImports)

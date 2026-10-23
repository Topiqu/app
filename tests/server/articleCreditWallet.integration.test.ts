// @vitest-environment node
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { createDatabaseClient } from '../../server/utils/database'
import {
  creditArticleCredits,
  getArticleCreditWallet,
  reserveArticleCredit,
  settleArticleCredit,
  withArticleCreditReservation,
} from '../../server/utils/articleCreditWallet'

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url) : null

describe.skipIf(!enabled)('article wallet on PostgreSQL', () => {
  beforeAll(() => {
    vi.stubGlobal('prisma', db)
    vi.stubGlobal('createError', createError)
  })
  afterAll(async () => {
    await db?.$disconnect()
    vi.unstubAllGlobals()
  })

  const tenant = async (articles: number) => {
    const id = randomUUID()
    await db!.clientSite.create({ data: { id, name: `article-wallet-${id}`, domain: `${id}.test` } })
    if (articles)
      await creditArticleCredits({
        clientSiteId: id,
        amount: articles,
        source: 'ADMIN',
        reason: 'test allowance',
        idempotencyKey: randomUUID(),
      })
    return id
  }

  it('serializes concurrent one-article reservations', async () => {
    const id = await tenant(1)
    const results = await Promise.allSettled([
      reserveArticleCredit(id, 'MANUAL_ARTICLE'),
      reserveArticleCredit(id, 'MANUAL_ARTICLE'),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(await getArticleCreditWallet(id)).toMatchObject({ available: 0, balance: 1, reserved: 1 })
  })

  it('serializes competing quality-priced reservations without overspending', async () => {
    const id = await tenant(4)
    const results = await Promise.allSettled([
      reserveArticleCredit(id, 'MANUAL_ARTICLE', randomUUID(), { articleQuality: 'ULTRA' }, 3),
      reserveArticleCredit(id, 'SCHEDULED_ARTICLE', randomUUID(), { articleQuality: 'HIGH' }, 2),
    ])
    const completed = results.filter((result) => result.status === 'fulfilled')
    expect(completed).toHaveLength(1)
    const reserved = completed[0]!.value.reserved
    expect(await getArticleCreditWallet(id)).toMatchObject({ balance: 4, reserved, available: 4 - reserved })
    await settleArticleCredit(completed[0]!.value, true)
    expect(await getArticleCreditWallet(id)).toMatchObject({
      balance: 4 - reserved,
      reserved: 0,
      available: 4 - reserved,
    })
  })

  it('charges success and returns a failed reservation', async () => {
    const id = await tenant(2)
    const completed = await reserveArticleCredit(id, 'MANUAL_ARTICLE')
    await settleArticleCredit(completed, true)
    await expect(
      withArticleCreditReservation(id, 'MANUAL_ARTICLE', async () => {
        throw new Error('provider failed')
      }),
    ).rejects.toThrow('provider failed')
    expect(await getArticleCreditWallet(id)).toMatchObject({ available: 1, balance: 1, reserved: 0 })
  })

  it('spends expiring plan articles before non-expiring purchases', async () => {
    const id = await tenant(0)
    const purchase = await creditArticleCredits({
      clientSiteId: id,
      amount: 2,
      source: 'PURCHASE',
      reason: 'purchase',
      idempotencyKey: randomUUID(),
    })
    const plan = await creditArticleCredits({
      clientSiteId: id,
      amount: 1,
      source: 'PLAN',
      reason: 'plan',
      expiresAt: new Date(Date.now() + 60_000),
      idempotencyKey: randomUUID(),
    })
    const operation = await reserveArticleCredit(id, 'MANUAL_ARTICLE')
    await settleArticleCredit(operation, true)
    expect(await db!.articleCreditGrant.findUnique({ where: { id: plan.id } })).toMatchObject({ remaining: 0 })
    expect(await db!.articleCreditGrant.findUnique({ where: { id: purchase.id } })).toMatchObject({ remaining: 2 })
  })
})

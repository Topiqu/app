// @vitest-environment node
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  creditArticleCredits,
  getArticleCreditWallet,
  reserveArticleCredit,
  settleArticleCredit,
  withArticleCreditReservation,
} from '../../server/utils/articleCreditWallet'

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? new PrismaClient({ datasourceUrl: url }) : null

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

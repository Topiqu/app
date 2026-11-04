// @vitest-environment node
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { toDatabaseJson } from '../../server/utils/databaseJson'
import { createDatabaseClient } from '../../server/utils/database'
import { ARTICLE_CREDIT_POLICY_VERSION } from '../../shared/utils/articleCredits'
import { creditArticleCredits, reserveArticleCredit } from '../../server/utils/articleCreditWallet'
import {
  creditAiUsagePack,
  creditInvoiceAiBudget,
  getAiAllowance,
  reserveAiAllowance,
  settleAiAllowance,
  withAiAllowance,
} from '../../server/utils/aiAllowance'

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url) : null

describe.skipIf(!enabled)('blog AI allowances on PostgreSQL', () => {
  beforeAll(() => {
    vi.stubGlobal('prisma', db)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('toDatabaseJson', toDatabaseJson)
    vi.stubGlobal('reportCaughtError', vi.fn())
    vi.stubGlobal('ARTICLE_CREDIT_POLICY_VERSION', ARTICLE_CREDIT_POLICY_VERSION)
    vi.stubGlobal(
      'planFromPriceId',
      (id: string) =>
        ({ price_pro: 'PRO', price_premium: 'PREMIUM', price_custom: 'CUSTOM' })[id as 'price_pro'] ?? null,
    )
  })
  afterAll(async () => {
    await db?.$disconnect()
    vi.unstubAllGlobals()
  })
  const site = async (options: { paid?: boolean; trial?: boolean; annual?: boolean; budget?: number } = {}) => {
    const id = randomUUID()
    const start = new Date(Date.now() - 86400000)
    const end = new Date(Date.now() + 29 * 86400000)
    await db!.clientSite.create({
      data: {
        id,
        name: `AI allowance ${id}`,
        domain: `${id}.test`,
        plan: 'PRO',
        stripeSubscriptionId: `sub_${id}`,
        billingPlan: options.annual ? 'ANNUAL' : 'MONTHLY',
        firstPaidAt: options.trial ? null : start,
        ...(options.trial ? { trialStartedAt: start, trialEndsAt: end } : {}),
        ...(options.budget === undefined ? {} : { aiBudgetMonthlyMicros: options.budget }),
      },
    })
    if (options.paid !== false && !options.trial)
      await creditArticleCredits({
        clientSiteId: id,
        amount: 30,
        source: 'PLAN',
        idempotencyKey: randomUUID(),
        reason: 'Paid fixture',
        periodStart: start,
        periodEnd: end,
        expiresAt: end,
      })
    return { id, start, end }
  }

  it('serializes concurrent reservations without overspending', async () => {
    const s = await site()
    const outcomes = await Promise.allSettled([
      reserveAiAllowance(s.id, 'BUDGET', 4_000_000),
      reserveAiAllowance(s.id, 'BUDGET', 4_000_000),
    ])
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect((await getAiAllowance(s.id)).allowances.find((row) => row.kind === 'BUDGET')?.remaining).toBe(3_350_000)
  })
  it('refunds unused funding exactly once', async () => {
    const s = await site()
    const reservation = await reserveAiAllowance(s.id, 'BUDGET', 1_000_000)
    await Promise.all([settleAiAllowance(reservation, 100_000), settleAiAllowance(reservation, 100_000)])
    expect((await getAiAllowance(s.id)).allowances.find((row) => row.kind === 'BUDGET')?.remaining).toBe(7_250_000)
  })
  it('retains uncertain provider cost and blocks new work at exhaustion', async () => {
    const s = await site({ budget: 100 })
    await settleAiAllowance(await reserveAiAllowance(s.id, 'BUDGET', 100), null)
    await expect(reserveAiAllowance(s.id, 'BUDGET', 1)).rejects.toMatchObject({
      statusCode: 402,
      data: { code: 'AI_ALLOWANCE_EXHAUSTED' },
    })
  })
  it('does not mint a new paid period when an invoice has not funded it', async () => {
    const s = await site({ paid: false })
    expect((await getAiAllowance(s.id)).active).toBe(false)
    await expect(reserveAiAllowance(s.id, 'EDIT')).rejects.toMatchObject({ statusCode: 403 })
    expect(await db!.aiAllowanceGrant.count({ where: { clientSiteId: s.id } })).toBe(0)
  })
  it('keeps a single cycle anchor and grants only the upgrade difference', async () => {
    const s = await site()
    await settleAiAllowance(await reserveAiAllowance(s.id, 'TRANSLATION', 20), 20)
    await db!.clientSite.update({ where: { id: s.id }, data: { plan: 'PREMIUM' } })
    await creditArticleCredits({
      clientSiteId: s.id,
      amount: 20,
      source: 'PLAN',
      idempotencyKey: randomUUID(),
      reason: 'Proration fixture',
      periodStart: new Date(),
      periodEnd: s.end,
      expiresAt: s.end,
    })
    const first = await getAiAllowance(s.id)
    const second = await getAiAllowance(s.id)
    expect(first.allowances.find((row) => row.kind === 'TRANSLATION')).toMatchObject({ total: 250, remaining: 230 })
    expect(second).toEqual(first)
  })
  it('gives one dollar for the whole trial and stops at its end', async () => {
    const s = await site({ trial: true })
    expect((await getAiAllowance(s.id)).allowances.find((row) => row.kind === 'BUDGET')?.total).toBe(1_000_000)
    await db!.clientSite.update({ where: { id: s.id }, data: { trialEndsAt: new Date(Date.now() - 1) } })
    await expect(reserveAiAllowance(s.id, 'EDIT')).rejects.toMatchObject({ statusCode: 403 })
  })
  it('normalizes annual base revenue monthly and keeps monthly operation counts', async () => {
    const s = await site({ annual: true })
    const allowance = await getAiAllowance(s.id)
    expect(allowance.allowances.find((row) => row.kind === 'BUDGET')?.total).toBe(5_880_000)
    expect(allowance.allowances.find((row) => row.kind === 'TRANSLATION')?.total).toBe(60)
  })
  it('credits a purchased usage pack once despite webhook replay', async () => {
    const s = await site()
    await Promise.all([
      creditAiUsagePack(s.id, 'small', 'cs_fixture_' + s.id),
      creditAiUsagePack(s.id, 'small', 'cs_fixture_' + s.id),
    ])
    expect((await getAiAllowance(s.id)).allowances.find((row) => row.kind === 'TRANSLATION')).toMatchObject({
      total: 70,
      remaining: 70,
    })
    expect(await db!.aiAllowanceGrant.count({ where: { clientSiteId: s.id, source: 'PURCHASE' } })).toBe(4)
  })
  it('funds the last reserved purchased article without exposing its funding to auxiliary work', async () => {
    const s = await site({ budget: 0 })
    const purchase = await creditArticleCredits({
      clientSiteId: s.id,
      amount: 1,
      source: 'PURCHASE',
      idempotencyKey: randomUUID(),
      reason: 'Purchase fixture',
    })
    await db!.articleCreditGrant.updateMany({ where: { clientSiteId: s.id, source: 'PLAN' }, data: { remaining: 0 } })
    // Keep the wallet aggregate coherent with the exhausted plan allocation.
    await db!.articleCreditWallet.update({ where: { id: s.id }, data: { balance: 1 } })
    const operation = await reserveArticleCredit(s.id, 'MANUAL_ARTICLE')
    expect((await db!.articleCreditGrant.findUniqueOrThrow({ where: { id: purchase.id } })).remaining).toBe(0)
    await expect(reserveAiAllowance(s.id, 'BUDGET', 1)).rejects.toMatchObject({ statusCode: 402 })
    const reservation = await reserveAiAllowance(s.id, 'BUDGET', 100, { articleOperationId: operation.id })
    await settleAiAllowance(reservation, 100)
    await expect(reserveAiAllowance(s.id, 'BUDGET', 1)).rejects.toMatchObject({ statusCode: 402 })
  })
  it('rejects a reservation paired with a different tenant', async () => {
    const [a, b] = await Promise.all([site(), site()])
    const reservation = await reserveAiAllowance(a.id, 'EDIT')
    await expect(settleAiAllowance({ id: reservation.id, clientSiteId: b.id }, 0)).rejects.toBeDefined()
    expect((await db!.aiUsageReservation.findUniqueOrThrow({ where: { id: reservation.id } })).status).toBe('RESERVED')
  })
  it('does not refund an expired worker that may have delivered its result', async () => {
    const s = await site()
    const reservation = await reserveAiAllowance(s.id, 'EDIT')
    await db!.aiUsageReservation.update({
      where: { id: reservation.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    })
    await getAiAllowance(s.id)
    await settleAiAllowance(reservation, 0)
    expect((await db!.aiUsageReservation.findUniqueOrThrow({ where: { id: reservation.id } })).status).toBe('UNKNOWN')
    expect((await getAiAllowance(s.id)).allowances.find((row) => row.kind === 'EDIT')?.remaining).toBe(199)
  })
  it('returns an operation count on failure while retaining any provider charges', async () => {
    const s = await site()
    await expect(
      withAiAllowance(s.id, 'EDIT', async () => {
        throw new Error('Provider failed')
      }),
    ).rejects.toThrow('Provider failed')
    expect((await getAiAllowance(s.id)).allowances.find((row) => row.kind === 'EDIT')?.remaining).toBe(200)
  })
  it('deducts an actual cost overrun from future available capacity', async () => {
    const s = await site({ budget: 1000 })
    await settleAiAllowance(await reserveAiAllowance(s.id, 'BUDGET', 100), 300)
    expect((await getAiAllowance(s.id)).allowances.find((row) => row.kind === 'BUDGET')?.remaining).toBe(700)
    await settleAiAllowance(await reserveAiAllowance(s.id, 'BUDGET', 100), 100)
    expect((await getAiAllowance(s.id)).allowances.find((row) => row.kind === 'BUDGET')?.remaining).toBe(600)
  })
  it('funds 15% of discounted base revenue while excluding additional-seat revenue', async () => {
    const s = await site()
    const invoice = {
      id: `invoice_${s.id}`,
      currency: 'usd',
      billing_reason: 'subscription_cycle',
      lines: {
        data: [
          {
            pricing: { price_details: { price: 'price_custom' } },
            amount: 15900,
            discount_amounts: [{ amount: 1590 }],
          },
          { pricing: { price_details: { price: 'price_members' } }, amount: 4000, discount_amounts: [] },
        ],
      },
    }
    await db!.$transaction((tx) =>
      creditInvoiceAiBudget(tx, {
        clientSiteId: s.id,
        invoice: invoice as never,
        price: { unit_amount: 15900, recurring: { interval: 'month' } } as never,
        periodStart: s.start,
        periodEnd: s.end,
      }),
    )
    expect((await getAiAllowance(s.id)).allowances.find((row) => row.kind === 'BUDGET')?.total).toBe(21_465_000)
    await db!.$transaction((tx) =>
      creditInvoiceAiBudget(tx, {
        clientSiteId: s.id,
        invoice: invoice as never,
        price: { unit_amount: 15900, recurring: { interval: 'month' } } as never,
        periodStart: s.start,
        periodEnd: s.end,
      }),
    )
    expect((await getAiAllowance(s.id)).allowances.find((row) => row.kind === 'BUDGET')?.total).toBe(21_465_000)
  })
  it('adds only funding actually paid for a mid-period upgrade and does not refill it on replay', async () => {
    const s = await site()
    await getAiAllowance(s.id)
    await db!.clientSite.update({ where: { id: s.id }, data: { plan: 'PREMIUM' } })
    const invoice = {
      id: `invoice_${s.id}`,
      currency: 'usd',
      billing_reason: 'subscription_update',
      lines: {
        data: [
          { pricing: { price_details: { price: 'price_pro' } }, amount: -490, discount_amounts: [] },
          { pricing: { price_details: { price: 'price_premium' } }, amount: 990, discount_amounts: [] },
        ],
      },
    }
    const input = {
      clientSiteId: s.id,
      invoice: invoice as never,
      price: { unit_amount: 9900, recurring: { interval: 'month' } } as never,
      periodStart: new Date(),
      periodEnd: s.end,
      recurringBaseCents: 9900,
    }
    await db!.$transaction((tx) => creditInvoiceAiBudget(tx, input))
    const expected = 7_350_000 + 750_000
    expect((await getAiAllowance(s.id)).allowances.find((row) => row.kind === 'BUDGET')?.total).toBe(expected)
    await db!.$transaction((tx) => creditInvoiceAiBudget(tx, input))
    expect((await getAiAllowance(s.id)).allowances.find((row) => row.kind === 'BUDGET')?.total).toBe(expected)
  })
  it('records a fully discounted invoice even when it grants no AI funding', async () => {
    const s = await site({ budget: 0 })
    const invoice = {
      id: `invoice_${s.id}`,
      currency: 'usd',
      billing_reason: 'subscription_cycle',
      lines: {
        data: [
          { pricing: { price_details: { price: 'price_pro' } }, amount: 4900, discount_amounts: [{ amount: 4900 }] },
        ],
      },
    }
    const input = {
      clientSiteId: s.id,
      invoice: invoice as never,
      price: { unit_amount: 4900, recurring: { interval: 'month' } } as never,
      periodStart: s.start,
      periodEnd: s.end,
    }
    await db!.$transaction((tx) => creditInvoiceAiBudget(tx, input))
    expect(await db!.aiAllowanceInvoice.findUnique({ where: { id: invoice.id } })).toMatchObject({ grantedMicros: 0 })
    await db!.clientSite.update({ where: { id: s.id }, data: { aiBudgetMonthlyMicros: 100 } })
    await db!.$transaction((tx) => creditInvoiceAiBudget(tx, input))
    expect((await db!.clientSite.findUniqueOrThrow({ where: { id: s.id } })).aiBudgetMonthlyMicros).toBe(100)
  })
  it('retains the discounted monthly funding from an annual invoice received after its first slot', async () => {
    const s = await site({ annual: true, budget: 0 })
    const paidThrough = new Date(Date.now() + 300 * 86400000)
    await db!.clientSite.update({ where: { id: s.id }, data: { paidThrough } })
    const invoice = {
      id: `invoice_${s.id}`,
      currency: 'usd',
      billing_reason: 'subscription_cycle',
      lines: {
        data: [
          { pricing: { price_details: { price: 'price_pro' } }, amount: 47040, discount_amounts: [{ amount: 4704 }] },
        ],
      },
    }
    await db!.$transaction((tx) =>
      creditInvoiceAiBudget(tx, {
        clientSiteId: s.id,
        invoice: invoice as never,
        price: { unit_amount: 47040, recurring: { interval: 'year' } } as never,
        periodStart: new Date(Date.now() - 60 * 86400000),
        periodEnd: new Date(Date.now() - 30 * 86400000),
        servicePeriodEnd: paidThrough,
      }),
    )
    expect((await db!.clientSite.findUniqueOrThrow({ where: { id: s.id } })).aiBudgetMonthlyMicros).toBe(5_292_000)
    expect((await getAiAllowance(s.id)).allowances.find((row) => row.kind === 'BUDGET')?.total).toBe(5_292_000)
  })
  it('preserves upgrade funding and the current baseline when the initial invoice arrives late', async () => {
    const s = await site({ budget: 0 })
    await db!.clientSite.update({ where: { id: s.id }, data: { plan: 'PREMIUM' } })
    const price = { id: 'price_premium', unit_amount: 9900, recurring: { interval: 'month' } } as never
    await db!.$transaction((tx) =>
      creditInvoiceAiBudget(tx, {
        clientSiteId: s.id,
        price,
        invoice: {
          id: `upgrade_${s.id}`,
          currency: 'usd',
          billing_reason: 'subscription_update',
          lines: { data: [{ pricing: { price_details: { price: 'price_premium' } }, amount: 500 }] },
        } as never,
        periodStart: s.start,
        periodEnd: s.end,
        recurringBaseCents: 9900,
      }),
    )
    await db!.$transaction((tx) =>
      creditInvoiceAiBudget(tx, {
        clientSiteId: s.id,
        price,
        invoice: {
          id: `base_${s.id}`,
          currency: 'usd',
          billing_reason: 'subscription_create',
          lines: { data: [{ pricing: { price_details: { price: 'price_pro' } }, amount: 4900 }] },
        } as never,
        periodStart: s.start,
        periodEnd: s.end,
      }),
    )
    expect((await getAiAllowance(s.id)).allowances.find((row) => row.kind === 'BUDGET')?.total).toBe(8_100_000)
    expect((await db!.clientSite.findUniqueOrThrow({ where: { id: s.id } })).aiBudgetMonthlyMicros).toBe(14_850_000)
  })
  it('uses the discounted recurring annual base for future slots, including a negative downgrade proration', async () => {
    const s = await site({ annual: true, budget: 10_000_000 })
    await db!.$transaction((tx) =>
      creditInvoiceAiBudget(tx, {
        clientSiteId: s.id,
        price: { id: 'price_pro', unit_amount: 47040, recurring: { interval: 'year' } } as never,
        invoice: {
          id: `downgrade_${s.id}`,
          currency: 'usd',
          billing_reason: 'subscription_update',
          lines: { data: [{ pricing: { price_details: { price: 'price_pro' } }, amount: -500 }] },
        } as never,
        periodStart: s.start,
        periodEnd: s.end,
        recurringBaseCents: 23520,
      }),
    )
    expect((await db!.clientSite.findUniqueOrThrow({ where: { id: s.id } })).aiBudgetMonthlyMicros).toBe(2_940_000)
    expect((await getAiAllowance(s.id)).allowances.find((row) => row.kind === 'BUDGET')?.total).toBe(2_940_000)
  })
})

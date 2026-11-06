// @vitest-environment node
import type StripeTypes from 'stripe'

import Stripe from 'stripe'
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DatabaseTransaction } from '../../../server/utils/database'

import { stubNitroImports } from '../../helpers/nitroImports'
import { createDatabaseClient } from '../../../server/utils/database'

const url = process.env.TEST_DATABASE_URL
const enabled = Boolean(url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL)
const db = enabled ? createDatabaseClient(url) : null
const stripe = new Stripe('sk_test_allowance_fixture')
const secret = 'whsec_allowance_fixture'

describe.skipIf(!enabled)('subscription invoice allowances on PostgreSQL', () => {
  beforeEach(async () => {
    await stubNitroImports(import('../../../server/utils/customBilling'), 'withBillingLease', 'assertBillingLease')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', secret)
    vi.stubEnv('STRIPE_WEBHOOK_SECRET_NEXT', '')
    vi.stubEnv('STRIPE_PRICE_PREMIUM', 'price_premium_fixture')
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('prisma', db)
    vi.stubGlobal('serializableTransaction', (work: (tx: DatabaseTransaction) => Promise<unknown>) =>
      db!.$transaction(work),
    )
    vi.stubGlobal('syncPlanFeatures', vi.fn())
    await stubNitroImports(
      import('../../../shared/utils/articleCredits'),
      'ARTICLE_CREDIT_POLICY_VERSION',
      'articleCreditsForPlan',
      'nextArticleCreditMonth',
    )
    await stubNitroImports(
      import('../../../server/utils/articleCreditWallet'),
      'creditArticleCredits',
      'grantPlanArticleCredits',
    )
    await stubNitroImports(import('../../../server/utils/aiAllowance'), 'creditInvoiceAiBudget', 'invoiceBaseNetCents')
    await stubNitroImports(
      import('../../../server/utils/stripeWebhook'),
      'extractSubscriptionId',
      'isSubscribablePlan',
      'marksFirstPayment',
      'planFromPriceId',
      'primaryPlanItem',
      'subscriptionPlan',
      'managedCustomSeats',
    )
    await stubNitroImports(
      import('../../../server/utils/translationLanguageBilling'),
      'isTranslationLanguageSubscription',
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
  afterAll(async () => {
    // The immutable ledger stays in the disposable database, as in the wallet integration tests.
    await db?.$disconnect()
  })

  const fixture = async (status: StripeTypes.Subscription.Status = 'active', linked = true) => {
    const id = randomUUID()
    const subscriptionId = `sub_${id}`
    const customerId = `cus_${id}`
    const site = await db!.clientSite.create({
      data: {
        name: `invoice-${id}`,
        domain: `${id}.test`,
        ...(linked ? { plan: 'PREMIUM', stripeSubscriptionId: subscriptionId, stripeCustomerId: customerId } : {}),
      },
    })
    const subscription = {
      id: subscriptionId,
      customer: customerId,
      status,
      metadata: { clientSiteId: site.id, plan: 'PREMIUM' },
      items: { data: [{ price: { id: 'price_premium_fixture', recurring: { interval: 'month' } } }] },
      trial_end: null,
    } as unknown as StripeTypes.Subscription
    vi.stubGlobal('useStripe', () => ({
      webhooks: stripe.webhooks,
      subscriptions: { retrieve: async () => subscription },
    }))
    const start = Math.floor(Date.now() / 1000)
    const invoice = {
      id: `in_${id}`,
      amount_paid: 9900,
      billing_reason: 'subscription_create',
      parent: { type: 'subscription_details', subscription_details: { subscription: subscriptionId } },
      lines: { data: [{ period: { start, end: start + 30 * 86400 } }] },
    }
    return { site, subscription, invoice }
  }

  const deliver = async (type: string, object: unknown) => {
    const payload = JSON.stringify({ id: `evt_${randomUUID()}`, type, data: { object } })
    const signature = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret })
    vi.stubGlobal('readRawBody', async () => payload)
    vi.stubGlobal('getHeader', () => signature)
    return (await import('../../../server/api/stripe/webhook')).default({} as never)
  }

  it('does not turn the zero-value trial invoice into a paid monthly allowance', async () => {
    const f = await fixture('trialing')
    f.invoice.amount_paid = 0
    f.subscription.trial_end = f.invoice.lines.data[0]!.period.end
    await deliver('invoice.paid', f.invoice)
    expect(await db!.articleCreditGrant.count({ where: { clientSiteId: f.site.id } })).toBe(0)
    expect((await db!.clientSite.findUniqueOrThrow({ where: { id: f.site.id } })).lastPaidAt).toEqual(f.site.lastPaidAt)
  })

  it('ignores the trial invoice when it arrives after the subscription becomes active', async () => {
    const f = await fixture()
    f.invoice.amount_paid = 0
    f.subscription.trial_end = f.invoice.lines.data[0]!.period.end
    await deliver('invoice.payment_succeeded', f.invoice)
    expect(await db!.articleCreditGrant.count({ where: { clientSiteId: f.site.id } })).toBe(0)
  })

  it.each(['paused', 'canceled', 'unpaid'] as const)(
    'ignores a paid invoice for a currently %s subscription',
    async (status) => {
      const f = await fixture(status)
      await deliver('invoice.paid', f.invoice)
      expect(await db!.articleCreditGrant.count({ where: { clientSiteId: f.site.id } })).toBe(0)
    },
  )

  it('grants an active fully discounted paid period and deduplicates both invoice events', async () => {
    const f = await fixture()
    f.invoice.amount_paid = 0
    await deliver('invoice.paid', f.invoice)
    await deliver('invoice.payment_succeeded', f.invoice)
    expect(
      await db!.articleCreditGrant.findMany({ where: { clientSiteId: f.site.id }, select: { amount: true } }),
    ).toEqual([{ amount: 100 }])
  })

  it('binds a paid subscription and grants once when both invoice events precede checkout', async () => {
    const f = await fixture('active', false)
    await deliver('invoice.paid', f.invoice)
    await deliver('invoice.payment_succeeded', f.invoice)
    await deliver('checkout.session.completed', {
      mode: 'subscription',
      client_reference_id: f.site.id,
      subscription: f.subscription.id,
      customer: f.subscription.customer,
    })
    expect(
      await db!.articleCreditGrant.findMany({ where: { clientSiteId: f.site.id }, select: { amount: true } }),
    ).toEqual([{ amount: 100 }])
    expect(await db!.clientSite.findUniqueOrThrow({ where: { id: f.site.id } })).toMatchObject({
      plan: 'PREMIUM',
      stripeSubscriptionId: f.subscription.id,
      firstPaidAt: expect.any(Date),
    })
  })

  it('does not bind an unlinked blog to a different existing Stripe customer', async () => {
    const f = await fixture('active', false)
    await db!.clientSite.update({ where: { id: f.site.id }, data: { stripeCustomerId: 'cus_other_fixture' } })
    await deliver('invoice.paid', f.invoice)
    expect(await db!.articleCreditGrant.count({ where: { clientSiteId: f.site.id } })).toBe(0)
    expect((await db!.clientSite.findUniqueOrThrow({ where: { id: f.site.id } })).stripeSubscriptionId).toBeNull()
  })

  it('binds an unlinked blog that already belongs to the invoiced customer', async () => {
    const f = await fixture('active', false)
    await db!.clientSite.update({
      where: { id: f.site.id },
      data: { stripeCustomerId: f.subscription.customer as string },
    })
    await deliver('invoice.paid', f.invoice)
    expect((await db!.articleCreditWallet.findUniqueOrThrow({ where: { id: f.site.id } })).balance).toBe(100)
  })

  it('does not replace a newer subscription with an older active invoice', async () => {
    const f = await fixture()
    await db!.clientSite.update({ where: { id: f.site.id }, data: { stripeSubscriptionId: 'sub_newer_fixture' } })
    await deliver('invoice.paid', f.invoice)
    expect(await db!.articleCreditGrant.count({ where: { clientSiteId: f.site.id } })).toBe(0)
    expect((await db!.clientSite.findUniqueOrThrow({ where: { id: f.site.id } })).stripeSubscriptionId).toBe(
      'sub_newer_fixture',
    )
  })

  it('preserves the original first payment timestamp across renewal and duplicate delivery', async () => {
    const f = await fixture()
    const firstPaidAt = new Date('2020-01-01T12:00:00Z')
    await db!.clientSite.update({ where: { id: f.site.id }, data: { firstPaidAt } })
    await deliver('invoice.paid', f.invoice)
    await deliver('invoice.payment_succeeded', f.invoice)
    expect((await db!.clientSite.findUniqueOrThrow({ where: { id: f.site.id } })).firstPaidAt).toEqual(firstPaidAt)
  })

  it('keeps annual prorations in the existing monthly slot and carries the discounted recurring budget', async () => {
    const f = await fixture()
    const start = new Date(Date.now() - 86400000)
    const end = new Date(Date.now() + 29 * 86400000)
    await db!.$transaction((tx) =>
      grantPlanArticleCredits(tx, {
        clientSiteId: f.site.id,
        plan: 'PRO',
        idempotencyKey: `initial_${f.site.id}`,
        reason: 'Initial paid slot',
        periodStart: start,
        periodEnd: end,
      }),
    )
    f.subscription.items.data[0]!.price.recurring!.interval = 'year'
    f.invoice.billing_reason = 'subscription_update'
    f.invoice.lines.data[0]!.period.end = Math.floor(Date.now() / 1000) + 300 * 86400
    const invoice = {
      ...f.invoice,
      currency: 'usd',
      lines: {
        data: [
          { ...f.invoice.lines.data[0], amount: 500, pricing: { price_details: { price: 'price_premium_fixture' } } },
        ],
      },
    }
    vi.stubGlobal('useStripe', () => ({
      webhooks: stripe.webhooks,
      subscriptions: { retrieve: async () => f.subscription },
      invoices: {
        createPreview: vi.fn().mockResolvedValue({
          currency: 'usd',
          lines: {
            data: [
              {
                amount: 95040,
                discount_amounts: [{ amount: 47520 }],
                pricing: { price_details: { price: 'price_premium_fixture' } },
              },
            ],
          },
        }),
      },
    }))
    await deliver('invoice.paid', invoice)
    const grants = await db!.articleCreditGrant.findMany({ where: { clientSiteId: f.site.id } })
    expect(grants).toHaveLength(2)
    expect(
      grants.every(
        (row) => row.periodStart?.getTime() === start.getTime() && row.periodEnd?.getTime() === end.getTime(),
      ),
    ).toBe(true)
    expect((await db!.clientSite.findUniqueOrThrow({ where: { id: f.site.id } })).aiBudgetMonthlyMicros).toBe(
      19_800_000,
    )
  })
})

// @vitest-environment node
import Stripe from 'stripe'
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'
import { createDatabaseClient } from '../../../server/utils/database'

// Explicit opt-in only. CI never creates remote subscriptions or payments.
const enabled = process.env.STRIPE_SANDBOX_VERIFY === '1'
const url = process.env.TEST_DATABASE_URL
const db =
  enabled && url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
    ? createDatabaseClient(url)
    : null
const stripe =
  enabled && /^(sk|rk)_test_/.test(process.env.STRIPE_SK ?? '')
    ? new Stripe(process.env.STRIPE_SK!, { apiVersion: '2025-08-27.basil' as Stripe.LatestApiVersion })
    : null
let siteId: string
let customerId: string
let subscriptionId: string
let body: { seats: number; quote?: string }

describe.skipIf(!enabled)('CUSTOM confirmed changes against the real Stripe sandbox', () => {
  beforeAll(async () => {
    if (!db || !stripe) throw new Error('Dedicated test database and Stripe sandbox key required')
    if ((await stripe.balance.retrieve()).livemode) throw new Error('Live Stripe access refused')
    const id = randomUUID()
    const customer = await stripe.customers.create({
      name: 'Topiqu synthetic seat verification',
      metadata: { topiqu_sandbox_verification: id },
    })
    customerId = customer.id
    const card = await stripe.paymentMethods.attach('pm_card_visa', { customer: customerId })
    await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: card.id } })
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: process.env.STRIPE_PRICE_PRO!, quantity: 1 }],
      metadata: { plan: 'PRO', topiqu_sandbox_verification: id },
    })
    subscriptionId = subscription.id
    const site = await db.clientSite.create({
      data: {
        name: `sandbox-seats-${id}`,
        domain: `${id}.test`,
        plan: 'PRO',
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        firstPaidAt: new Date(),
      },
    })
    siteId = site.id
    vi.stubGlobal('prisma', db)
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('assertBlogNotClosing', vi.fn())
    vi.stubGlobal('useStripe', () => stripe)
    vi.stubGlobal('requireTenantScope', async () => ({
      user: { id: 'synthetic-owner' },
      membership: { clientSiteId: siteId },
    }))
    vi.stubGlobal('consumeRateLimit', async () => true)
    vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (value: unknown) => unknown) => parse(body))
    vi.stubGlobal('rejectShopifyBilled', vi.fn())
    vi.stubGlobal('reportCaughtError', vi.fn())
    vi.stubGlobal('syncPlanFeatures', vi.fn())
    vi.stubGlobal('logAction', vi.fn())
    vi.stubGlobal('serializableTransaction', (work: Parameters<NonNullable<typeof db>['$transaction']>[0]) =>
      db!.$transaction(work),
    )
    await stubNitroImports(
      import('../../../server/utils/customBilling'),
      'billingFingerprint',
      'signSeatQuote',
      'readSeatQuote',
      'withBillingLease',
      'assertBillingLease',
      'renewBillingLease',
    )
    await stubNitroImports(
      import('../../../server/utils/stripeWebhook'),
      'primaryPlanItem',
      'managedCustomSeats',
      'subscriptionPlan',
    )
    await stubNitroImports(
      import('../../../server/utils/stripePricing'),
      'getConfiguredPlanPrice',
      'getConfiguredMemberPrice',
    )
  }, 60_000)
  afterAll(async () => {
    // Delete only synthetic objects created by this test; never touch catalog or customer accounts.
    if (stripe && subscriptionId) await stripe.subscriptions.cancel(subscriptionId)
    if (stripe && customerId) await stripe.customers.del(customerId)
    await db?.$disconnect()
    vi.unstubAllGlobals()
  })

  it('quotes and charges the same prorated upgrade, makes replay harmless, and reduces unused capacity without an extra invoice', async () => {
    const route = (await import('../../../server/api/stripe/seats.post')).default
    body = { seats: 3 }
    const quote = await route({} as never)
    expect(quote).toMatchObject({ recurring: 19900, interval: 'month', currency: 'USD', decrease: false })
    if (!('quote' in quote)) throw new Error('Missing seat quote')
    const invoiceCount = (await stripe!.invoices.list({ customer: customerId })).data.length
    body = { seats: 5, quote: quote.quote }
    await expect(route({} as never)).rejects.toMatchObject({ statusCode: 409 })
    expect((await stripe!.invoices.list({ customer: customerId })).data).toHaveLength(invoiceCount)
    body = { seats: 3, quote: quote.quote }
    expect(await route({} as never)).toMatchObject({ applied: true, pending: false })
    const updated = await stripe!.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice'] })
    const invoice = updated.latest_invoice as Stripe.Invoice
    expect(invoice.livemode).toBe(false)
    expect(invoice.status).toBe('paid')
    expect(invoice.amount_due).toBe(quote.due)
    expect(await db!.clientSite.findUniqueOrThrow({ where: { id: siteId } })).toMatchObject({
      plan: 'CUSTOM',
      paidTeamSeats: 3,
    })
    const paidCount = (await stripe!.invoices.list({ customer: customerId })).data.length
    await route({} as never)
    expect((await stripe!.invoices.list({ customer: customerId })).data).toHaveLength(paidCount)
    body = { seats: 5 }
    const more = await route({} as never)
    if (!('quote' in more)) throw new Error('Missing capacity quote')
    body = { seats: 5, quote: more.quote }
    expect(await route({} as never)).toMatchObject({ applied: true })
    const beforeReduction = (await stripe!.invoices.list({ customer: customerId })).data.length
    body = { seats: 3 }
    const less = await route({} as never)
    expect(less).toMatchObject({ due: 0, recurring: 19900, decrease: true })
    if (!('quote' in less)) throw new Error('Missing decrease quote')
    body = { seats: 3, quote: less.quote }
    expect(await route({} as never)).toMatchObject({ applied: true })
    expect((await stripe!.invoices.list({ customer: customerId })).data).toHaveLength(beforeReduction)
    expect(await db!.clientSite.findUniqueOrThrow({ where: { id: siteId } })).toMatchObject({ paidTeamSeats: 3 })
    body = { seats: 5, quote: more.quote }
    await expect(route({} as never)).rejects.toMatchObject({ statusCode: 409, data: { code: 'BILLING_QUOTE_STALE' } })
    expect(await db!.clientSite.findUniqueOrThrow({ where: { id: siteId } })).toMatchObject({ paidTeamSeats: 3 })
    expect((await stripe!.invoices.list({ customer: customerId })).data).toHaveLength(beforeReduction)
    const failingCard = await stripe!.paymentMethods.attach('pm_card_chargeCustomerFail', { customer: customerId })
    await stripe!.customers.update(customerId, { invoice_settings: { default_payment_method: failingCard.id } })
    body = { seats: 4 }
    const unpaid = await route({} as never)
    if (!('quote' in unpaid)) throw new Error('Missing pending-payment quote')
    body = { seats: 4, quote: unpaid.quote }
    expect(await route({} as never)).toMatchObject({ applied: false, pending: true, url: expect.any(String) })
    expect(await db!.clientSite.findUniqueOrThrow({ where: { id: siteId } })).toMatchObject({ paidTeamSeats: 3 })
  }, 120_000)
})

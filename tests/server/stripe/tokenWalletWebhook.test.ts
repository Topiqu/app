import Stripe from 'stripe'
import { createError } from 'h3'
import { webcrypto } from 'node:crypto'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  vi.stubGlobal('withBillingLease', (_id: string, work: (leaseId: string) => Promise<unknown>) => work('fixture-lease'))
  vi.stubGlobal('assertBillingLease', vi.fn().mockResolvedValue(undefined))
  await stubNitroImports(
    import('../../../server/utils/stripeWebhook'),
    'extractSubscriptionId',
    'isSubscribablePlan',
    'marksFirstPayment',
    'planFromPriceId',
    'primaryPlanItem',
    'subscriptionPlan',
    'managedCustomSeats',
    'revokesPlan',
  )
  await stubNitroImports(
    import('../../../server/utils/translationLanguageBilling'),
    'isTranslationLanguageSubscription',
  )
  vi.stubGlobal('syncTranslationLanguageSubscription', vi.fn())
  vi.stubGlobal('cancelTranslationLanguageSubscription', vi.fn())
  vi.stubGlobal('creditInvoiceAiBudget', vi.fn())
}

const stripe = new Stripe('sk_test_dummy')
const secret = 'whsec_wallet_test_only'
const credit = vi.fn()
describe('wallet checkout webhook handler', () => {
  beforeEach(() => {
    vi.resetModules()
    credit.mockReset()
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', secret)
    vi.stubEnv('STRIPE_WEBHOOK_SECRET_NEXT', '')
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('useStripe', () => stripe)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('creditArticleCredits', credit)
    vi.stubGlobal(
      'handleAgencyStripeEvent',
      vi.fn(async () => false),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
  async function deliver(type: string, paymentStatus: string, tamper = false, signingSecret = secret) {
    const payload = JSON.stringify({
      id: 'evt_wallet',
      type,
      data: {
        object: {
          id: 'cs_wallet',
          mode: 'payment',
          client_reference_id: 'site_wallet',
          payment_status: paymentStatus,
          metadata: { articles: '5' },
        },
      },
    })
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: signingSecret })
    vi.stubGlobal('readRawBody', async () => (tamper ? payload.replace('"5"', '"9"') : payload))
    vi.stubGlobal('getHeader', () => signature)
    const handler = (await import('../../../server/api/stripe/webhook')).default
    return handler({} as never)
  }
  it.each(['checkout.session.completed', 'checkout.session.async_payment_succeeded'])(
    'fulfills paid %s using the same checkout key',
    async (type) => {
      await deliver(type, 'paid')
      expect(credit).toHaveBeenCalledWith(
        expect.objectContaining({
          clientSiteId: 'site_wallet',
          amount: 5,
          source: 'PURCHASE',
          idempotencyKey: 'stripe:checkout:cs_wallet',
        }),
      )
    },
  )
  it('does not fulfill an unpaid completed session', async () => {
    await deliver('checkout.session.completed', 'unpaid')
    expect(credit).not.toHaveBeenCalled()
  })
  it('does not fulfill a failed asynchronous payment', async () => {
    await deliver('checkout.session.async_payment_failed', 'unpaid')
    expect(credit).not.toHaveBeenCalled()
  })
  it('rejects tampered payloads before any credit write', async () => {
    await expect(deliver('checkout.session.completed', 'paid', true)).rejects.toMatchObject({ statusCode: 400 })
    expect(credit).not.toHaveBeenCalled()
  })

  it('accepts the next endpoint signature during a versioned webhook rollout', async () => {
    const nextSecret = 'whsec_synthetic_next_endpoint'
    vi.stubEnv('STRIPE_WEBHOOK_SECRET_NEXT', nextSecret)
    await deliver('checkout.session.completed', 'paid', false, nextSecret)
    expect(credit).toHaveBeenCalledOnce()
    expect(credit).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'stripe:checkout:cs_wallet' }))
  })

  it('verifies signatures with the asynchronous crypto provider selected by Bun in the release image', async () => {
    const cryptoProvider = Stripe.createSubtleCryptoProvider(webcrypto.subtle as SubtleCrypto)
    vi.stubGlobal('useStripe', () => ({
      webhooks: {
        constructEvent: (body: string | Buffer, signature: string, endpointSecret: string) =>
          stripe.webhooks.constructEvent(body, signature, endpointSecret, undefined, cryptoProvider),
        constructEventAsync: (body: string | Buffer, signature: string, endpointSecret: string) =>
          stripe.webhooks.constructEventAsync(body, signature, endpointSecret, undefined, cryptoProvider),
      },
    }))
    await deliver('checkout.session.completed', 'paid')
    expect(credit).toHaveBeenCalledOnce()
  })

  it('keeps rejecting tampering and unrelated secrets during a dual-secret rollout', async () => {
    const nextSecret = 'whsec_synthetic_next_endpoint'
    vi.stubEnv('STRIPE_WEBHOOK_SECRET_NEXT', nextSecret)
    await expect(deliver('checkout.session.completed', 'paid', false, 'whsec_unrelated')).rejects.toMatchObject({
      statusCode: 400,
    })
    await expect(deliver('checkout.session.completed', 'paid', true, nextSecret)).rejects.toMatchObject({
      statusCode: 400,
    })
    expect(credit).not.toHaveBeenCalled()
  })

  it('fails closed when neither endpoint secret is configured', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')
    await expect(deliver('checkout.session.completed', 'paid')).rejects.toMatchObject({ statusCode: 400 })
    expect(credit).not.toHaveBeenCalled()
  })
})

beforeEach(stubImports)

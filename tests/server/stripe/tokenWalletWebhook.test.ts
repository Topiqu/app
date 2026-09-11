import Stripe from 'stripe'
import { createError } from 'h3'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const stripe = new Stripe('sk_test_dummy')
const secret = 'whsec_wallet_test_only'
const credit = vi.fn()
describe('wallet checkout webhook handler', () => {
  beforeEach(() => {
    vi.resetModules()
    credit.mockReset()
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', secret)
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('useStripe', () => stripe)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('creditTokens', credit)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
  async function deliver(type: string, paymentStatus: string, tamper = false) {
    const payload = JSON.stringify({
      id: 'evt_wallet',
      type,
      data: {
        object: {
          id: 'cs_wallet',
          mode: 'payment',
          client_reference_id: 'site_wallet',
          payment_status: paymentStatus,
          metadata: { tokens: '500' },
        },
      },
    })
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret })
    vi.stubGlobal('readRawBody', async () => (tamper ? payload.replace('500', '900') : payload))
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
          amount: 500,
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
})

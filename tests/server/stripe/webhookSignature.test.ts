import Stripe from 'stripe'
import { describe, expect, it } from 'vitest'

const SECRET = 'whsec_testonly000000000000000000000'
const OTHER_SECRET = 'whsec_testonly111111111111111111111'

const stripe = new Stripe('sk_test_dummy', { apiVersion: '2025-03-31.basil' as Stripe.LatestApiVersion })

const rawBody = JSON.stringify({
  id: 'evt_test',
  type: 'checkout.session.completed',
  data: { object: { id: 'cs_test', mode: 'subscription', client_reference_id: 'site_1' } },
})

const sign = (payload: string, secret: string) =>
  stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp: Math.floor(Date.now() / 1000) })

describe('stripe webhook signature verification', () => {
  it('accepts a payload signed with the configured secret', () => {
    const event = stripe.webhooks.constructEvent(rawBody, sign(rawBody, SECRET), SECRET)

    expect(event.type).toBe('checkout.session.completed')
  })

  it('rejects a payload signed with a different endpoint secret', () => {
    expect(() => stripe.webhooks.constructEvent(rawBody, sign(rawBody, OTHER_SECRET), SECRET)).toThrow(
      Stripe.errors.StripeSignatureVerificationError,
    )
  })

  it('rejects a body tampered with after signing', () => {
    const signature = sign(rawBody, SECRET)
    const tampered = rawBody.replace('site_1', 'site_2')

    expect(() => stripe.webhooks.constructEvent(tampered, signature, SECRET)).toThrow(
      Stripe.errors.StripeSignatureVerificationError,
    )
  })

  it('rejects a body that was parsed and re-serialised, so the handler must keep the raw body', () => {
    const signature = sign(rawBody, SECRET)
    const reserialised = JSON.stringify(JSON.parse(rawBody), null, 2)

    expect(() => stripe.webhooks.constructEvent(reserialised, signature, SECRET)).toThrow(
      Stripe.errors.StripeSignatureVerificationError,
    )
  })

  it('rejects a signature older than the tolerance window', () => {
    const stale = stripe.webhooks.generateTestHeaderString({
      payload: rawBody,
      secret: SECRET,
      timestamp: Math.floor(Date.now() / 1000) - 3600,
    })

    expect(() => stripe.webhooks.constructEvent(rawBody, stale, SECRET, 300)).toThrow(
      Stripe.errors.StripeSignatureVerificationError,
    )
  })
})

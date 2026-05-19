import type Stripe from 'stripe'

import { describe, expect, it } from 'vitest'

import { extractSubscriptionId, isSubscribablePlan } from '../../../server/utils/stripeWebhook'

const buildInvoice = (parent: Stripe.Invoice['parent']): Stripe.Invoice => ({ parent }) as unknown as Stripe.Invoice

describe('extractSubscriptionId (Stripe API 2025-03-31.basil)', () => {
  it('returns subscription id when stored as string on parent.subscription_details', () => {
    const invoice = buildInvoice({
      type: 'subscription_details',
      subscription_details: { subscription: 'sub_123', metadata: {} },
    } as unknown as Stripe.Invoice['parent'])

    expect(extractSubscriptionId(invoice)).toBe('sub_123')
  })

  it('returns subscription id when expanded as object', () => {
    const invoice = buildInvoice({
      type: 'subscription_details',
      subscription_details: { subscription: { id: 'sub_456' }, metadata: {} },
    } as unknown as Stripe.Invoice['parent'])

    expect(extractSubscriptionId(invoice)).toBe('sub_456')
  })

  it('returns null for one-off invoice without subscription parent', () => {
    expect(extractSubscriptionId(buildInvoice(null))).toBeNull()
  })

  it('returns null when subscription_details is missing', () => {
    const invoice = buildInvoice({ type: 'manual' } as unknown as Stripe.Invoice['parent'])
    expect(extractSubscriptionId(invoice)).toBeNull()
  })
})

describe('isSubscribablePlan', () => {
  it.each(['PRO', 'PREMIUM'])('accepts %s', (plan) => {
    expect(isSubscribablePlan(plan)).toBe(true)
  })

  it.each(['BASIC', 'CUSTOM', '', undefined, null, 42])('rejects %s', (value) => {
    expect(isSubscribablePlan(value)).toBe(false)
  })
})

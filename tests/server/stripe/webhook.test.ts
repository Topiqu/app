import type Stripe from 'stripe'

import { describe, expect, it } from 'vitest'

import { extractSubscriptionId, isSubscribablePlan, revokesPlan } from '../../../server/utils/stripeWebhook'

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

describe('revokesPlan', () => {
  // `unpaid` is the one that matters: a Stripe network configured to mark unpaid instead
  // of cancelling never emits `customer.subscription.deleted`, so without this the tenant
  // keeps PREMIUM (and keeps generating) on an invoice they never paid.
  it.each(['unpaid', 'incomplete_expired', 'canceled'] as const)('revokes on terminal status %s', (status) => {
    expect(revokesPlan(status)).toBe(true)
  })

  it('leaves past_due alone — that is the dunning grace period, not a loss of plan', () => {
    expect(revokesPlan('past_due')).toBe(false)
  })

  it.each(['active', 'trialing', 'incomplete', 'paused'] as const)('keeps the plan on %s', (status) => {
    expect(revokesPlan(status)).toBe(false)
  })
})

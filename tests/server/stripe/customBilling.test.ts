// @vitest-environment node
import type Stripe from 'stripe'

import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { customPriceCents } from '../../../shared/utils/billingCatalog'
import { managedCustomSeats, subscriptionPlan } from '../../../server/utils/stripeWebhook'
import {
  billingFingerprint,
  readSeatQuote,
  signSeatQuote,
  withBillingLease,
  renewBillingLease,
} from '../../../server/utils/customBilling'

const subscription = (seats = 3) =>
  ({
    id: 'sub_fixture',
    metadata: {},
    items: {
      data: [
        { id: 'si_member', quantity: seats - 1, price: { id: 'price_member', recurring: { interval: 'month' } } },
        { id: 'si_base', quantity: 1, price: { id: 'price_base', recurring: { interval: 'month' } } },
      ],
    },
  }) as unknown as Stripe.Subscription
beforeEach(() => {
  vi.stubEnv('AUTH_SECRET', 'synthetic-signing-secret-for-tests')
  vi.stubEnv('STRIPE_PRICE_CUSTOM', 'price_base')
  vi.stubEnv('STRIPE_PRICE_CUSTOM_MEMBER', 'price_member')
  vi.stubGlobal('createError', createError)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('CUSTOM paid seats and confirmation', () => {
  it('prices the approved minimum and annual discount without dollar rounding', () => {
    expect(customPriceCents(3, 'month')).toBe(19900)
    expect(customPriceCents(3, 'year')).toBe(191040)
    expect(customPriceCents(5, 'month')).toBe(23900)
    expect(customPriceCents(5, 'year')).toBe(229440)
    expect(() => customPriceCents(2, 'month')).toThrow(RangeError)
    expect(() => customPriceCents(3.5, 'year')).toThrow(RangeError)
  })
  it('recognizes both line items regardless of Stripe ordering and rejects an underpaid or malformed minimum', () => {
    expect(managedCustomSeats(subscription())).toBe(3)
    expect(subscriptionPlan(subscription())).toBe('CUSTOM')
    expect(managedCustomSeats(subscription(2))).toBeNull()
    expect(subscriptionPlan(subscription(2))).toBeNull()
    const invalid = subscription()
    invalid.items.data[1]!.quantity = 2
    expect(subscriptionPlan(invalid)).toBeNull()
  })
  it('binds explicit confirmation to the user, blog, subscription version, seats and expiry', () => {
    const value = {
      userId: 'owner',
      clientSiteId: 'blog-a',
      subscriptionId: 'sub_fixture',
      fingerprint: billingFingerprint(subscription()),
      seats: 5,
      interval: 'month' as const,
      prorationDate: Math.floor(Date.now() / 1000),
      due: 4000,
    }
    const token = signSeatQuote(value)
    expect(readSeatQuote(token, 'owner', 'blog-a')).toMatchObject(value)
    expect(() => readSeatQuote(token, 'other-owner', 'blog-a')).toThrow()
    expect(() => readSeatQuote(token, 'owner', 'blog-b')).toThrow()
    expect(() => readSeatQuote(token + 'x', 'owner', 'blog-a')).toThrow()
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 6 * 60_000)
    expect(() => readSeatQuote(token, 'owner', 'blog-a')).toThrow()
  })
  it('changes the fingerprint when capacity changes', () => {
    expect(billingFingerprint(subscription(3))).not.toBe(billingFingerprint(subscription(4)))
  })
  it('does not call a provider when another billing mutation owns the lease', async () => {
    const run = vi.fn()
    vi.stubGlobal('prisma', { clientSite: { updateMany: async () => ({ count: 0 }) } })
    await expect(withBillingLease('blog-a', run)).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'BILLING_CHANGE_PENDING' },
    })
    expect(run).not.toHaveBeenCalled()
  })
  it('releases only its own lease after a remote operation fails', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    vi.stubGlobal('prisma', { clientSite: { updateMany } })
    await expect(
      withBillingLease('blog-a', async () => {
        throw new Error('Provider unavailable')
      }),
    ).rejects.toThrow('Provider unavailable')
    expect(updateMany).toHaveBeenCalledTimes(2)
    const leaseId = updateMany.mock.calls[0]![0].data.billingLeaseId
    expect(updateMany.mock.calls[1]![0]).toEqual({
      where: { id: 'blog-a', billingLeaseId: leaseId },
      data: { billingLeaseId: null, billingLeaseUntil: null },
    })
  })
  it('rejects an expired external mutation before sending it to Stripe', async () => {
    vi.stubGlobal('prisma', { clientSite: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } })
    await expect(renewBillingLease('blog-a', 'expired-lease')).rejects.toMatchObject({ statusCode: 409 })
    expect(prisma.clientSite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'blog-a',
          billingLeaseId: 'expired-lease',
          billingLeaseUntil: { gt: expect.any(Date) },
        }),
      }),
    )
  })
})

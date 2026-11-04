import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { domainError, isManagedDomain } from '../../shared/utils/domain'
import { canConnectCustomDomain, requireCustomDomainBilling } from '../../server/utils/domains/billing'

const cards = vi.fn()
const report = vi.fn()
const trial = {
  id: 'tenant',
  plan: 'PREMIUM' as const,
  firstPaidAt: null,
  trialStartedAt: new Date('2026-10-01'),
  stripeCustomerId: null as string | null,
  billingPlan: 'MONTHLY' as const,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-02T12:00:00Z'))
  cards.mockResolvedValue({ data: [] })
  vi.stubGlobal('useStripe', () => ({ paymentMethods: { list: cards } }))
  vi.stubGlobal('reportCaughtError', report)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('domain billing access', () => {
  it('does not treat a card-less Premium trial as a payment', async () => {
    expect(await canConnectCustomDomain(trial)).toBe(false)
    await expect(requireCustomDomainBilling(trial)).rejects.toMatchObject({
      statusCode: 403,
      data: { code: 'paymentRequired' },
    })
    expect(cards).not.toHaveBeenCalled()
  })

  it('rejects a new domain request before reserving a hostname or contacting providers', async () => {
    const transaction = vi.fn()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('requireDomainAccess', async () => ({
      user: { id: 'owner' },
      clientSiteId: trial.id,
      db: { clientSite: { findUnique: async () => ({ ...trial, domain: 'old.topiqu.com', pendingDomain: null }) } },
    }))
    vi.stubGlobal('consumeRateLimit', async () => true)
    vi.stubGlobal('readValidatedBody', async () => ({ domain: 'next.example.com' }))
    vi.stubGlobal('normalizeDomain', (domain: string) => domain)
    vi.stubGlobal('domainError', domainError)
    vi.stubGlobal('isManagedDomain', isManagedDomain)
    vi.stubGlobal('prisma', { $transaction: transaction })
    const handler = (await import('../../server/api/domain/pending.post')).default
    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 403, data: { code: 'paymentRequired' } })
    expect(transaction).not.toHaveBeenCalled()
  })

  it.each(['BASIC', 'PREMIUM'] as const)(
    'allows a free Topiqu subdomain request on %s without billing providers',
    async (plan) => {
      const reserve = vi.fn()
      const updateMany = vi.fn().mockResolvedValue({ count: 1 })
      cards.mockRejectedValue(new Error('billing is unavailable'))
      vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
      vi.stubGlobal('requireDomainAccess', async () => ({
        user: { id: 'owner' },
        clientSiteId: trial.id,
        db: {
          clientSite: {
            findUnique: async () => ({
              ...trial,
              plan,
              stripeCustomerId: 'cus_own',
              domain: 'old.topiqu.com',
              pendingDomain: null,
            }),
          },
        },
      }))
      vi.stubGlobal('consumeRateLimit', async () => true)
      vi.stubGlobal('readValidatedBody', async () => ({ domain: 'next.topiqu.com' }))
      vi.stubGlobal('normalizeDomain', (domain: string) => domain)
      vi.stubGlobal('domainError', domainError)
      vi.stubGlobal('isManagedDomain', isManagedDomain)
      vi.stubGlobal('isDomainTaken', async () => false)
      vi.stubGlobal('reserveDomainConnection', reserve)
      vi.stubGlobal('domainDnsRecords', (domain: string) => ({ domain }))
      vi.stubGlobal('logAction', vi.fn())
      vi.stubGlobal('getIp', () => '127.0.0.1')
      vi.stubGlobal('prisma', {
        $transaction: (run: (tx: unknown) => Promise<unknown>) => run({ clientSite: { updateMany } }),
      })
      const handler = (await import('../../server/api/domain/pending.post')).default
      await expect(handler({} as never)).resolves.toMatchObject({ pending: { domain: 'next.topiqu.com' } })
      expect(updateMany).toHaveBeenCalledOnce()
      expect(cards).not.toHaveBeenCalled()
      expect(reserve).not.toHaveBeenCalled()
    },
  )

  it.each([
    { ...trial, firstPaidAt: new Date('2026-10-15') },
    { ...trial, plan: 'CUSTOM' as const, trialStartedAt: null },
    { ...trial, plan: 'PRO' as const, trialStartedAt: null },
    { ...trial, plan: 'CUSTOM' as const },
    { ...trial, plan: 'PRO' as const, billingPlan: 'PERMANENT' as const },
  ])('preserves paid and manually assigned plan access', async (site) => {
    expect(await canConnectCustomDomain(site)).toBe(true)
    expect(cards).not.toHaveBeenCalled()
  })

  it('does not mistake a Stripe customer for a saved card', async () => {
    expect(await canConnectCustomDomain({ ...trial, stripeCustomerId: 'cus_own' })).toBe(false)
    expect(cards).toHaveBeenCalledWith(
      { customer: 'cus_own', type: 'card', limit: 100 },
      { timeout: 5000, maxNetworkRetries: 0 },
    )
  })

  it('keeps the Pro-or-higher custom-domain requirement on Basic even for a past payer', async () => {
    expect(
      await canConnectCustomDomain({ ...trial, plan: 'BASIC', firstPaidAt: new Date(), stripeCustomerId: 'cus_own' }),
    ).toBe(false)
    expect(cards).not.toHaveBeenCalled()
  })

  it('allows a saved unexpired card, including its expiry month, while ignoring expired cards', async () => {
    cards.mockResolvedValue({
      data: [{ card: { exp_year: 2026, exp_month: 10 } }, { card: { exp_year: 2026, exp_month: 11 } }],
    })
    expect(await canConnectCustomDomain({ ...trial, stripeCustomerId: 'cus_own' })).toBe(true)
    cards.mockResolvedValue({ data: [{ card: { exp_year: 2026, exp_month: 10 } }] })
    expect(await canConnectCustomDomain({ ...trial, stripeCustomerId: 'cus_own' })).toBe(false)
  })

  it('fails closed during a billing outage without confusing it with a missing payment', async () => {
    cards.mockRejectedValue(new Error('provider error with private metadata'))
    await expect(requireCustomDomainBilling({ ...trial, stripeCustomerId: 'cus_own' })).rejects.toMatchObject({
      statusCode: 503,
      data: { code: 'billingUnavailable' },
    })
    expect(report).toHaveBeenCalledWith('Domain billing check failed', new Error('DOMAIN_BILLING_UNAVAILABLE'), {
      clientSiteId: 'tenant',
    })
  })
})

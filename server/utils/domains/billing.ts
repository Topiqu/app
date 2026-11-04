import type { ClientSite } from '~~/generated/zenstack/models'

import { createError } from 'h3'

export const domainBillingSelect = {
  id: true,
  plan: true,
  firstPaidAt: true,
  trialStartedAt: true,
  stripeCustomerId: true,
  billingPlan: true,
} as const

type DomainBillingSite = Pick<ClientSite, keyof typeof domainBillingSelect>

/** A trial's Premium entitlement is not proof of payment or a manual grant. */
export const canConnectCustomDomain = async (site: DomainBillingSite): Promise<boolean | null> => {
  if (site.plan === 'BASIC') return false
  if (site.plan === 'CUSTOM' || site.billingPlan === 'PERMANENT' || site.firstPaidAt || !site.trialStartedAt)
    return true
  if (!site.stripeCustomerId) return false
  try {
    const cards = await useStripe().paymentMethods.list(
      { customer: site.stripeCustomerId, type: 'card', limit: 100 },
      { timeout: 5000, maxNetworkRetries: 0 },
    )
    const now = new Date()
    return cards.data.some(
      ({ card }) =>
        card &&
        (card.exp_year > now.getUTCFullYear() ||
          (card.exp_year === now.getUTCFullYear() && card.exp_month >= now.getUTCMonth() + 1)),
    )
  } catch {
    await reportCaughtError('Domain billing check failed', new Error('DOMAIN_BILLING_UNAVAILABLE'), {
      clientSiteId: site.id,
    })
    return null
  }
}

export const requireCustomDomainBilling = async (site: DomainBillingSite) => {
  const allowed = await canConnectCustomDomain(site)
  if (allowed) return
  throw createError({
    statusCode: allowed === null ? 503 : 403,
    message: allowed === null ? 'Domain billing check unavailable' : 'Custom domains require payment or a saved card',
    data: { code: allowed === null ? 'billingUnavailable' : 'paymentRequired' },
  })
}

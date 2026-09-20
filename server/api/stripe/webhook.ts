import type Stripe from 'stripe'
import type { ClientPlan } from '@prisma/client'

import { articleCreditsForPlan, nextArticleCreditMonth } from '~~/shared/utils/articleCredits'
import {
  extractSubscriptionId,
  isSubscribablePlan,
  marksFirstPayment,
  planFromPriceId,
  revokesPlan,
} from '~~/server/utils/stripeWebhook'

/**
 * `clearSubscription` only for a terminal deletion — an `unpaid` subscription still exists in
 * Stripe and revives the moment the invoice is paid, so we keep the id to stay attached to it.
 * `stripeCustomerId` survives either way, or the tenant loses portal access to their invoices.
 */
const revokeToBasic = async (clientSiteId: string, { clearSubscription }: { clearSubscription: boolean }) => {
  await serializableTransaction(async (tx) => {
    await tx.clientSite.update({
      where: { id: clientSiteId },
      data: {
        plan: 'BASIC',
        stripePriceId: null,
        ...(clearSubscription ? { stripeSubscriptionId: null } : {}),
      },
    })

    await syncPlanFeatures(tx, clientSiteId)
  })
}

export default defineEventHandler(async (event) => {
  const body = await readRawBody(event, false)
  const sig = getHeader(event, 'stripe-signature')
  const stripe = useStripe()

  let stripeEvent
  try {
    stripeEvent = stripe.webhooks.constructEvent(body!, sig!, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    throw createError({ statusCode: 400 })
  }

  if (
    stripeEvent.type === 'checkout.session.completed' ||
    stripeEvent.type === 'checkout.session.async_payment_succeeded'
  ) {
    const session = stripeEvent.data.object as Stripe.Checkout.Session
    const clientSiteId = session.client_reference_id ?? session.metadata?.clientSiteId
    if (!clientSiteId) return { received: true }

    if (session.mode === 'subscription') {
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
      const subscription = subscriptionId ? await stripe.subscriptions.retrieve(subscriptionId) : null
      const priceId = subscription?.items.data[0]?.price.id ?? null

      const metadataPlan = session.metadata?.plan
      const derivedPlan = planFromPriceId(priceId) ?? (isSubscribablePlan(metadataPlan) ? metadataPlan : null)
      const paid = marksFirstPayment(subscription?.status, derivedPlan)

      await serializableTransaction(async (tx) => {
        await tx.clientSite.update({
          where: { id: clientSiteId },
          data: {
            ...(derivedPlan ? { plan: derivedPlan as ClientPlan } : {}),
            ...(paid ? { firstPaidAt: { set: new Date() }, lastPaidAt: new Date() } : {}),
            stripeCustomerId: customerId ?? undefined,
            stripeSubscriptionId: subscriptionId ?? undefined,
            stripePriceId: priceId ?? undefined,
          },
        })

        if (derivedPlan) await syncPlanFeatures(tx, clientSiteId)
      })
      return { received: true }
    }

    const articles = Number(session.metadata?.articles ?? 0)
    if (Number.isSafeInteger(articles) && articles > 0 && session.payment_status === 'paid') {
      await creditArticleCredits({
        clientSiteId,
        amount: articles,
        source: 'PURCHASE',
        idempotencyKey: `stripe:checkout:${session.id}`,
        reason: 'Article pack purchase',
      })
    }
    return { received: true }
  }

  if (stripeEvent.type === 'customer.subscription.updated') {
    const subscription = stripeEvent.data.object as Stripe.Subscription
    const previous = stripeEvent.data.previous_attributes as Partial<Stripe.Subscription> | undefined
    const clientSiteId = subscription.metadata?.clientSiteId
    if (!clientSiteId) return { received: true }

    const currentPriceId = subscription.items.data[0]?.price.id ?? null
    const metadataPlan = subscription.metadata?.plan
    const derivedPlan = planFromPriceId(currentPriceId) ?? (isSubscribablePlan(metadataPlan) ? metadataPlan : null)
    const trialEnded = previous?.status === 'trialing' && subscription.status === 'active'

    // Terminal non-paying states never produce a `deleted` event — revoke here or not at all.
    if (revokesPlan(subscription.status)) {
      await revokeToBasic(clientSiteId, { clearSubscription: subscription.status === 'canceled' })
      return { received: true }
    }

    // Fires on both trial-end promotion and portal-driven plan changes (PRO↔PREMIUM).
    if (subscription.status === 'active' && derivedPlan) {
      await serializableTransaction(async (tx) => {
        await tx.clientSite.update({
          where: { id: clientSiteId },
          data: {
            plan: derivedPlan as ClientPlan,
            stripePriceId: currentPriceId ?? undefined,
            ...(trialEnded ? { firstPaidAt: { set: new Date() }, lastPaidAt: new Date() } : {}),
          },
        })

        await syncPlanFeatures(tx, clientSiteId)
      })
    }
    return { received: true }
  }

  if (stripeEvent.type === 'customer.subscription.deleted') {
    const subscription = stripeEvent.data.object as Stripe.Subscription
    const clientSiteId = subscription.metadata?.clientSiteId
    if (!clientSiteId) return { received: true }

    await revokeToBasic(clientSiteId, { clearSubscription: true })
    return { received: true }
  }

  if (stripeEvent.type === 'invoice.paid' || stripeEvent.type === 'invoice.payment_succeeded') {
    const invoice = stripeEvent.data.object as Stripe.Invoice
    const subscriptionId = extractSubscriptionId(invoice)
    if (!subscriptionId) return { received: true }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const clientSiteId = subscription.metadata?.clientSiteId
    if (!clientSiteId) return { received: true }

    const price = subscription.items.data[0]?.price
    const derivedPlan =
      planFromPriceId(price?.id) ??
      (isSubscribablePlan(subscription.metadata?.plan) ? subscription.metadata.plan : null)
    const amount = articleCreditsForPlan(derivedPlan)
    const linePeriod = invoice.lines.data[0]?.period
    const periodStart = linePeriod ? new Date(linePeriod.start * 1000) : new Date()
    const invoicePeriodEnd = linePeriod ? new Date(linePeriod.end * 1000) : new Date(Date.now() + 31 * 86400000)
    const annual = price?.recurring?.interval === 'year'
    const periodEnd = annual ? nextArticleCreditMonth(periodStart) : invoicePeriodEnd

    await serializableTransaction(async (tx) => {
      await tx.clientSite.update({
        where: { id: clientSiteId },
        data: {
          lastPaidAt: new Date(),
          lastInvoicedAt: new Date(),
          ...(annual ? { billingPlan: 'ANNUAL' } : { billingPlan: 'MONTHLY' }),
        },
      })
      if (derivedPlan && amount > 0) {
        // A mid-period PRO → PREMIUM invoice should add only the 10-article difference, not
        // another complete allowance. Downgrades never claw back articles already granted.
        const activePlanGrants = await tx.articleCreditGrant.aggregate({
          where: { clientSiteId, source: 'PLAN', expiresAt: { gt: periodStart } },
          _sum: { amount: true },
        })
        const grantAmount = Math.max(0, amount - (activePlanGrants._sum.amount ?? 0))
        if (grantAmount > 0)
          await creditArticleCredits(
            {
              clientSiteId,
              amount: grantAmount,
              source: 'PLAN',
              idempotencyKey: `stripe:invoice:${invoice.id}`,
              reason: `${derivedPlan} included articles`,
              periodStart,
              periodEnd,
              expiresAt: periodEnd,
            },
            tx,
          )
      }
    })
  }

  return { received: true }
})

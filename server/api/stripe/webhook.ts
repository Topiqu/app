import type Stripe from 'stripe'
import type { ClientPlan } from '@prisma/client'

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
  await prisma.$transaction(async (tx) => {
    await tx.clientSite.update({
      where: { id: clientSiteId },
      data: {
        plan: 'BASIC',
        stripePriceId: null,
        ...(clearSubscription ? { stripeSubscriptionId: null } : {}),
      },
    })

    await syncPlanFeatures(tx, clientSiteId, 'BASIC')
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

  if (stripeEvent.type === 'checkout.session.completed') {
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

      await prisma.$transaction(async (tx) => {
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

        if (derivedPlan) await syncPlanFeatures(tx, clientSiteId, derivedPlan as ClientPlan)
      })
      return { received: true }
    }

    const tokens = Number(session.metadata?.tokens ?? 0)
    if (tokens > 0) {
      await prisma.clientSite.update({
        where: { id: clientSiteId },
        data: {
          tokenRemaining: { increment: tokens },
        },
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
      await prisma.$transaction(async (tx) => {
        await tx.clientSite.update({
          where: { id: clientSiteId },
          data: {
            plan: derivedPlan as ClientPlan,
            stripePriceId: currentPriceId ?? undefined,
            ...(trialEnded ? { firstPaidAt: { set: new Date() }, lastPaidAt: new Date() } : {}),
          },
        })

        await syncPlanFeatures(tx, clientSiteId, derivedPlan as ClientPlan)
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

  if (stripeEvent.type === 'invoice.payment_succeeded') {
    const invoice = stripeEvent.data.object as Stripe.Invoice
    const subscriptionId = extractSubscriptionId(invoice)
    if (!subscriptionId) return { received: true }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const clientSiteId = subscription.metadata?.clientSiteId
    if (!clientSiteId) return { received: true }

    await prisma.clientSite.update({
      where: { id: clientSiteId },
      data: { lastPaidAt: new Date(), lastInvoicedAt: new Date() },
    })
  }

  return { received: true }
})

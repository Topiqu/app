import type { ClientPlan } from '@prisma/client'

import Stripe from 'stripe'
import { extractSubscriptionId, isSubscribablePlan } from '~~/server/utils/stripeWebhook'

export default defineEventHandler(async (event) => {
  const body = await readRawBody(event, false)
  const sig = getHeader(event, 'stripe-signature')
  const stripe = new Stripe(process.env.STRIPE_SK!)

  let stripeEvent
  try {
    stripeEvent = stripe.webhooks.constructEvent(body!, sig!, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    throw createError({ statusCode: 400 })
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object as Stripe.Checkout.Session
    const clientSiteId = session.client_reference_id

    if (!clientSiteId) return { received: true }

    if (session.mode === 'subscription') {
      const plan = session.metadata?.plan
      if (!isSubscribablePlan(plan)) return { received: true }

      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
      const subscription = subscriptionId ? await stripe.subscriptions.retrieve(subscriptionId) : null
      const priceId = subscription?.items.data[0]?.price.id ?? null

      await prisma.clientSite.update({
        where: { id: clientSiteId },
        data: {
          plan: plan as ClientPlan,
          stripeCustomerId: customerId ?? undefined,
          stripeSubscriptionId: subscriptionId ?? undefined,
          stripePriceId: priceId ?? undefined,
          firstPaidAt: { set: new Date() },
          lastPaidAt: new Date(),
        },
      })
      return { received: true }
    }

    const tokens = Number(session.metadata?.tokens ?? 0)
    if (tokens > 0) {
      await prisma.clientSite.update({
        where: { id: clientSiteId },
        data: {
          tokenRemaining: { increment: tokens },
          totalUsage: { increment: tokens },
        },
      })
    }
    return { received: true }
  }

  if (stripeEvent.type === 'customer.subscription.deleted') {
    const subscription = stripeEvent.data.object as Stripe.Subscription
    const clientSiteId = subscription.metadata?.clientSiteId
    if (!clientSiteId) return { received: true }

    await prisma.clientSite.update({
      where: { id: clientSiteId },
      data: {
        plan: 'BASIC',
        stripeSubscriptionId: null,
        stripePriceId: null,
      },
    })
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

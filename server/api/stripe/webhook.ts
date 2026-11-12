import type Stripe from 'stripe'
import type { ClientPlan } from '~~/generated/zenstack/models'
import type { AiUsagePackId } from '~~/shared/utils/billingCatalog'

/** Read provider state inside the same lease as app billing changes. A preliminary read,
 * when needed, supplies identity only; it is never used for entitlement reconciliation. */
const withSubscriptionBilling = async <T>(
  stripe: Stripe,
  subscriptionId: string,
  hint: string | undefined,
  run: (subscription: Stripe.Subscription, clientSiteId: string, leaseId: string) => Promise<T>,
) => {
  const clientSiteId = hint ?? (await stripe.subscriptions.retrieve(subscriptionId)).metadata?.clientSiteId
  if (!clientSiteId) return { received: true }
  return withBillingLease(clientSiteId, async (leaseId) => {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    if (subscription.metadata?.clientSiteId !== clientSiteId) return { received: true }
    return run(subscription, clientSiteId, leaseId)
  })
}

const recordFirstPayment = (tx: DatabaseTransaction, clientSiteId: string, subscriptionId: string) =>
  tx.clientSite.updateMany({
    where: { id: clientSiteId, stripeSubscriptionId: subscriptionId, firstPaidAt: null },
    data: { firstPaidAt: new Date() },
  })

/**
 * `clearSubscription` only for a terminal deletion — an `unpaid` subscription still exists in
 * Stripe and revives the moment the invoice is paid, so we keep the id to stay attached to it.
 * `stripeCustomerId` survives either way, or the tenant loses portal access to their invoices.
 */
const revokeToBasic = async (
  clientSiteId: string,
  subscriptionId: string,
  { clearSubscription }: { clearSubscription: boolean },
  leaseId: string,
) => {
  await serializableTransaction(async (tx) => {
    await assertBillingLease(tx, clientSiteId, leaseId)
    const changed = await tx.clientSite.updateMany({
      where: {
        id: clientSiteId,
        stripeSubscriptionId: subscriptionId,
        billingProvider: 'STRIPE',
        billingAccountId: null,
        deletedAt: null,
      },
      data: {
        plan: 'BASIC',
        stripePriceId: null,
        paidTeamSeats: null,
        ...(clearSubscription ? { stripeSubscriptionId: null } : {}),
      },
    })

    if (changed.count) await syncPlanFeatures(tx, clientSiteId)
  })
  // The add-on helper rechecks BASIC; retries must reach it even after the primary ID was cleared.
  await cancelTranslationLanguageSubscription(clientSiteId)
}

export default defineEventHandler(async (event) => {
  const body = await readRawBody(event, false)
  const sig = getHeader(event, 'stripe-signature')
  const stripe = useStripe()

  let stripeEvent: Stripe.Event | undefined
  // Accept both endpoint signatures while the versioned webhook is rolled out.
  for (const secret of new Set([process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_WEBHOOK_SECRET_NEXT])) {
    if (!secret) continue
    try {
      stripeEvent = await stripe.webhooks.constructEventAsync(body!, sig!, secret)
      break
    } catch {
      // A mismatched endpoint secret must not bypass signature verification.
    }
  }
  if (!stripeEvent) throw createError({ statusCode: 400 })
  if (await handleAgencyStripeEvent(stripe, stripeEvent)) return { received: true }

  if (
    stripeEvent.type === 'checkout.session.completed' ||
    stripeEvent.type === 'checkout.session.async_payment_succeeded'
  ) {
    const session = stripeEvent.data.object as Stripe.Checkout.Session
    const clientSiteId = session.client_reference_id ?? session.metadata?.clientSiteId
    if (!clientSiteId) return { received: true }

    if (session.metadata?.kind === 'AI_USAGE_PACK') {
      const pack = aiUsagePack(session.metadata.packId)
      if (
        pack &&
        session.mode === 'payment' &&
        session.payment_status === 'paid' &&
        session.currency === 'usd' &&
        session.amount_total === pack.priceCents
      )
        await creditAiUsagePack(clientSiteId, session.metadata.packId as AiUsagePackId, session.id)
      return { received: true }
    }

    if (isTranslationLanguageSubscription(session.metadata)) {
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
      if (subscriptionId) await syncTranslationLanguageSubscription(await stripe.subscriptions.retrieve(subscriptionId))
      return { received: true }
    }

    if (session.mode === 'subscription') {
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
      if (!subscriptionId) return { received: true }
      return withSubscriptionBilling(
        stripe,
        subscriptionId,
        clientSiteId,
        async (subscription, clientSiteId, leaseId) => {
          const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
          if (!subscription || !['active', 'trialing'].includes(subscription.status)) return { received: true }
          const priceId = primaryPlanItem(subscription)?.price.id ?? null
          const subscriptionInterval = primaryPlanItem(subscription)?.price.recurring?.interval
          const billingPlan =
            subscriptionInterval === 'year' ? 'ANNUAL' : subscriptionInterval === 'month' ? 'MONTHLY' : null

          const metadataPlan = session.metadata?.plan
          const derivedPlan = subscriptionPlan(subscription, metadataPlan)
          const paid = marksFirstPayment(subscription?.status, derivedPlan)

          await serializableTransaction(async (tx) => {
            await assertBillingLease(tx, clientSiteId, leaseId)
            const changed = await tx.clientSite.updateMany({
              where: {
                id: clientSiteId,
                deletedAt: null,
                billingProvider: 'STRIPE',
                // An agency blog's plan is the agency's; a stray blog subscription cannot override it.
                billingAccountId: null,
                OR: [{ stripeSubscriptionId: null }, { stripeSubscriptionId: subscriptionId }],
              },
              data: {
                ...(derivedPlan ? { plan: derivedPlan as ClientPlan } : {}),
                ...(derivedPlan
                  ? { paidTeamSeats: derivedPlan === 'CUSTOM' ? managedCustomSeats(subscription) : null }
                  : {}),
                ...(paid ? { lastPaidAt: new Date() } : {}),
                stripeCustomerId: customerId ?? undefined,
                stripeSubscriptionId: subscriptionId ?? undefined,
                stripePriceId: priceId ?? undefined,
                ...(billingPlan ? { billingPlan } : {}),
              },
            })

            if (changed.count && paid && subscriptionId) await recordFirstPayment(tx, clientSiteId, subscriptionId)
            if (changed.count && derivedPlan) await syncPlanFeatures(tx, clientSiteId)
          })
          return { received: true }
        },
      )
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

  if (
    stripeEvent.type === 'customer.subscription.updated' ||
    stripeEvent.type === 'customer.subscription.paused' ||
    stripeEvent.type === 'customer.subscription.resumed'
  ) {
    // Events can be duplicated or delivered out of order: reconcile the provider's current state.
    const eventSubscription = stripeEvent.data.object as Stripe.Subscription
    return withSubscriptionBilling(
      stripe,
      eventSubscription.id,
      eventSubscription.metadata?.clientSiteId,
      async (subscription, clientSiteId, leaseId) => {
        const previous = stripeEvent.data.previous_attributes as Partial<Stripe.Subscription> | undefined
        if (isTranslationLanguageSubscription(subscription.metadata)) {
          await syncTranslationLanguageSubscription(subscription)
          return { received: true }
        }

        const currentPriceId = primaryPlanItem(subscription)?.price.id ?? null
        const currentInterval = primaryPlanItem(subscription)?.price.recurring?.interval
        const billingPlan = currentInterval === 'year' ? 'ANNUAL' : currentInterval === 'month' ? 'MONTHLY' : null
        const metadataPlan = subscription.metadata?.plan
        const derivedPlan = subscriptionPlan(subscription, metadataPlan)
        const trialEnded =
          (previous?.status === 'trialing' ||
            previous?.status === 'paused' ||
            stripeEvent.type === 'customer.subscription.resumed') &&
          subscription.status === 'active'

        // Non-paying states may not produce a `deleted` event, so access is also revoked here.
        if (revokesPlan(subscription.status)) {
          await revokeToBasic(
            clientSiteId,
            subscription.id,
            { clearSubscription: subscription.status === 'canceled' },
            leaseId,
          )
          return { received: true }
        }

        // Fires on both trial-end promotion and portal-driven plan changes (PRO↔PREMIUM).
        if (subscription.status === 'active' && derivedPlan) {
          await serializableTransaction(async (tx) => {
            await assertBillingLease(tx, clientSiteId, leaseId)
            const changed = await tx.clientSite.updateMany({
              where: {
                id: clientSiteId,
                stripeSubscriptionId: subscription.id,
                billingProvider: 'STRIPE',
                billingAccountId: null,
                deletedAt: null,
              },
              data: {
                plan: derivedPlan as ClientPlan,
                paidTeamSeats: derivedPlan === 'CUSTOM' ? managedCustomSeats(subscription) : null,
                stripePriceId: currentPriceId ?? undefined,
                ...(billingPlan ? { billingPlan } : {}),
                ...(trialEnded ? { lastPaidAt: new Date() } : {}),
              },
            })

            if (changed.count && trialEnded) await recordFirstPayment(tx, clientSiteId, subscription.id)
            if (changed.count) await syncPlanFeatures(tx, clientSiteId)
          })
        }
        return { received: true }
      },
    )
  }

  if (stripeEvent.type === 'customer.subscription.deleted') {
    const subscription = stripeEvent.data.object as Stripe.Subscription
    const clientSiteId = subscription.metadata?.clientSiteId
    if (!clientSiteId) return { received: true }
    if (isTranslationLanguageSubscription(subscription.metadata)) {
      await syncTranslationLanguageSubscription(subscription)
      return { received: true }
    }

    return withBillingLease(clientSiteId, async (leaseId) => {
      await revokeToBasic(clientSiteId, subscription.id, { clearSubscription: true }, leaseId)
      return { received: true }
    })
  }

  if (stripeEvent.type === 'invoice.paid' || stripeEvent.type === 'invoice.payment_succeeded') {
    const invoice = stripeEvent.data.object as Stripe.Invoice
    const subscriptionId = extractSubscriptionId(invoice)
    if (!subscriptionId) return { received: true }

    return withSubscriptionBilling(
      stripe,
      subscriptionId,
      invoice.parent?.subscription_details?.metadata?.clientSiteId,
      async (subscription, clientSiteId, leaseId) => {
        if (isTranslationLanguageSubscription(subscription.metadata) || subscription.status !== 'active')
          return { received: true }

        const linePeriod = invoice.lines.data[0]?.period
        // A free trial has a paid zero-value invoice too, including when delivered after trial end.
        if (subscription.trial_end && linePeriod && linePeriod.start < subscription.trial_end) return { received: true }

        const price = primaryPlanItem(subscription)?.price
        const derivedPlan = subscriptionPlan(subscription)
        if (!derivedPlan) return { received: true }
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
        let periodStart = linePeriod ? new Date(linePeriod.start * 1000) : new Date()
        const invoicePeriodEnd = linePeriod ? new Date(linePeriod.end * 1000) : new Date(Date.now() + 31 * 86400000)
        const annual = price?.recurring?.interval === 'year'
        let periodEnd = annual ? nextArticleCreditMonth(periodStart) : invoicePeriodEnd
        // Previewing recurring charges creates no invoice or payment. Stripe applies the
        // contract's discounts; list price cannot fund discounted annual continuation slots.
        const recurringBaseCents =
          invoice.billing_reason === 'subscription_update' && price
            ? invoiceBaseNetCents(
                await stripe.invoices.createPreview({ subscription: subscriptionId, preview_mode: 'recurring' }),
                price.id,
              )
            : undefined

        await serializableTransaction(async (tx) => {
          await assertBillingLease(tx, clientSiteId, leaseId)
          if (invoice.billing_reason === 'subscription_update') {
            const activeSlot = await tx.articleCreditGrant.findFirst({
              where: {
                accountId: clientSiteId,
                source: 'PLAN',
                periodStart: { lte: new Date() },
                expiresAt: { gt: new Date() },
              },
              orderBy: { periodStart: 'asc' },
              select: { periodStart: true, periodEnd: true },
            })
            if (activeSlot?.periodStart && activeSlot.periodEnd) {
              periodStart = activeSlot.periodStart
              periodEnd = activeSlot.periodEnd
            }
          }
          const changed = await tx.clientSite.updateMany({
            where: {
              id: clientSiteId,
              billingProvider: 'STRIPE',
              billingAccountId: null,
              deletedAt: null,
              // Invoice events can precede Checkout; never replace another subscription or customer.
              OR: [
                { stripeSubscriptionId: subscriptionId },
                {
                  stripeSubscriptionId: null,
                  OR: [{ stripeCustomerId: null }, { stripeCustomerId: customerId }],
                },
              ],
            },
            data: {
              plan: derivedPlan,
              paidTeamSeats: derivedPlan === 'CUSTOM' ? managedCustomSeats(subscription) : null,
              stripeSubscriptionId: subscriptionId,
              stripeCustomerId: customerId,
              stripePriceId: price?.id,
              lastPaidAt: new Date(),
              lastInvoicedAt: new Date(),
              ...(annual ? { billingPlan: 'ANNUAL' } : { billingPlan: 'MONTHLY' }),
            },
          })
          if (changed.count) {
            await recordFirstPayment(tx, clientSiteId, subscriptionId)
            await tx.clientSite.updateMany({
              where: { id: clientSiteId, OR: [{ paidThrough: null }, { paidThrough: { lt: invoicePeriodEnd } }] },
              data: { paidThrough: invoicePeriodEnd },
            })
            await syncPlanFeatures(tx, clientSiteId)
            await grantPlanArticleCredits(tx, {
              clientSiteId,
              plan: derivedPlan,
              idempotencyKey: `stripe:invoice:${invoice.id}`,
              reason: `${derivedPlan} included articles`,
              periodStart,
              periodEnd,
            })
            if (price)
              await creditInvoiceAiBudget(tx, {
                clientSiteId,
                invoice,
                price,
                periodStart,
                periodEnd,
                servicePeriodEnd: invoicePeriodEnd,
                recurringBaseCents,
              })
          }
        })
        return { received: true }
      },
    )
  }

  return { received: true }
})

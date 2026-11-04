import type Stripe from 'stripe'

import { z } from 'zod'
import { createHash } from 'node:crypto'
import { CUSTOM_MIN_SEATS, CUSTOM_MAX_SEATS, customPriceCents } from '~~/shared/utils/billingCatalog'

const bodySchema = z.object({
  seats: z.number().int().min(CUSTOM_MIN_SEATS).max(CUSTOM_MAX_SEATS),
  quote: z.string().max(4096).optional(),
})

/** Explicit owner confirmation buys capacity; inviting a colleague never charges a card. */
export default defineEventHandler(async (event) => {
  const { user, membership } = await requireTenantScope(event, 'BILLING_CHANGE')
  if (!(await consumeRateLimit(`billing-seats:${membership.clientSiteId}`, 10, 60)))
    throw createError({ statusCode: 429, message: 'Too many billing changes' })
  const body = await readValidatedBody(event, bodySchema.parse)
  return withBillingLease(membership.clientSiteId, async (leaseId) => {
    const site = await prisma.clientSite.findUniqueOrThrow({
      where: { id: membership.clientSiteId },
      select: { plan: true, paidTeamSeats: true, stripeSubscriptionId: true, billingProvider: true },
    })
    rejectShopifyBilled(event, site.billingProvider)
    if (!site.stripeSubscriptionId || (site.plan === 'CUSTOM' && site.paidTeamSeats === null))
      throw createError({ statusCode: 409, message: 'Managed subscription required' })
    const stripe = useStripe()
    const subscription = await stripe.subscriptions.retrieve(site.stripeSubscriptionId)
    if (
      subscription.status !== 'active' ||
      subscription.pending_update ||
      subscription.schedule ||
      subscription.cancel_at_period_end
    )
      throw createError({ statusCode: 409, message: 'Resolve the existing subscription change first' })
    const primary = primaryPlanItem(subscription)
    const rawInterval = primary?.price.recurring?.interval
    if (!primary || (rawInterval !== 'month' && rawInterval !== 'year') || !subscriptionPlan(subscription))
      throw createError({ statusCode: 409, message: 'Unsupported subscription' })
    if (subscription.items.data.length !== (subscriptionPlan(subscription) === 'CUSTOM' ? 2 : 1))
      throw createError({ statusCode: 409, message: 'Subscription items need operator review' })
    const interval = rawInterval === 'year' ? 'year' : 'month'
    const [base, member] = await Promise.all([
      getConfiguredPlanPrice('CUSTOM', interval),
      getConfiguredMemberPrice(interval),
    ])
    if (!base || !member) throw createError({ statusCode: 503, message: 'CUSTOM price unavailable' })
    const [members, invites] = await Promise.all([
      prisma.tenantMembership.count({
        where: { clientSiteId: membership.clientSiteId, deletedAt: null, user: { deletedAt: null } },
      }),
      prisma.tenantInvitation.count({
        where: {
          clientSiteId: membership.clientSiteId,
          deletedAt: null,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
    ])
    if (body.seats < members + invites)
      throw createError({ statusCode: 409, message: 'Seats are still in use', data: { code: 'TEAM_SEATS_IN_USE' } })
    const currentSeats = managedCustomSeats(subscription)
    const existingMember = subscription.items.data.find((item) => item.price.id === member.id)
    const items: Stripe.SubscriptionUpdateParams.Item[] = [
      { id: primary.id, price: base.id, quantity: 1 },
      { ...(existingMember ? { id: existingMember.id } : {}), price: member.id, quantity: body.seats - 1 },
    ]
    const decrease = currentSeats !== null && body.seats < currentSeats
    if (currentSeats === body.seats) return { applied: true, pending: false, url: null }
    const quote = body.quote ? readSeatQuote(body.quote, user.id, membership.clientSiteId) : null
    const prorationDate = quote?.prorationDate ?? Math.floor(Date.now() / 1000)
    if (
      quote &&
      (quote.subscriptionId !== subscription.id ||
        quote.fingerprint !== billingFingerprint(subscription) ||
        quote.seats !== body.seats ||
        quote.interval !== interval)
    )
      throw createError({ statusCode: 409, message: 'Subscription changed; request a new quote' })
    // Decreases remove unused capacity now, bill the lower amount at renewal, and never issue a surprise refund.
    const preview = decrease
      ? null
      : await stripe.invoices.createPreview({
          subscription: subscription.id,
          subscription_details: { items, proration_date: prorationDate, proration_behavior: 'always_invoice' },
        })
    const due = preview?.amount_due ?? 0
    const recurring = customPriceCents(body.seats, interval)
    if (!quote)
      return {
        quote: signSeatQuote({
          userId: user.id,
          clientSiteId: membership.clientSiteId,
          subscriptionId: subscription.id,
          fingerprint: billingFingerprint(subscription),
          seats: body.seats,
          interval,
          prorationDate,
          due,
        }),
        due,
        recurring,
        currency: 'USD',
        interval,
        decrease,
      }
    if (quote.due !== due) throw createError({ statusCode: 409, message: 'Invoice changed; request a new quote' })
    await renewBillingLease(membership.clientSiteId, leaseId)
    await stripe.subscriptions.update(
      subscription.id,
      {
        items,
        proration_behavior: decrease ? 'none' : 'always_invoice',
        ...(decrease ? {} : { proration_date: prorationDate, payment_behavior: 'pending_if_incomplete' as const }),
        expand: ['latest_invoice'],
      },
      {
        idempotencyKey: `seats:${createHash('sha256').update(body.quote!).digest('hex')}`,
        timeout: 30_000,
        maxNetworkRetries: 0,
      },
    )
    // Stripe may return a cached idempotent response after the seats changed again.
    const updated = await stripe.subscriptions.retrieve(subscription.id, { expand: ['latest_invoice'] })
    const paidSeats = managedCustomSeats(updated)
    if (!updated.pending_update && paidSeats !== body.seats)
      throw createError({
        statusCode: 409,
        message: 'Billing quote already used; review the current price',
        data: { code: 'BILLING_QUOTE_STALE' },
      })
    if (!updated.pending_update && paidSeats !== null && updated.status === 'active') {
      await serializableTransaction(async (tx) => {
        await assertBillingLease(tx, membership.clientSiteId, leaseId)
        const changed = await tx.clientSite.updateMany({
          where: { id: membership.clientSiteId, stripeSubscriptionId: updated.id },
          data: { plan: 'CUSTOM', paidTeamSeats: paidSeats, stripePriceId: base.id },
        })
        if (changed.count) await syncPlanFeatures(tx, membership.clientSiteId)
      })
    }
    const invoice = typeof updated.latest_invoice === 'object' ? updated.latest_invoice : null
    await logAction({
      action: 'BILLING_SEATS_CHANGED',
      userId: user.id,
      clientSiteId: membership.clientSiteId,
      metadata: { from: currentSeats, to: body.seats, due, interval, pending: Boolean(updated.pending_update) },
    })
    return {
      applied: !updated.pending_update,
      pending: Boolean(updated.pending_update),
      url: updated.pending_update ? (invoice?.hosted_invoice_url ?? null) : null,
    }
  })
})

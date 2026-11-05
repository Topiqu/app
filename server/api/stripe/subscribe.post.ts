import { z } from 'zod'
import { CUSTOM_MIN_SEATS, CUSTOM_MAX_SEATS } from '~~/shared/utils/billingCatalog'

export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const {
    plan,
    interval: bodyInterval,
    clientSiteId: bodyClientSiteId,
    origin,
    locale,
    seats,
  } = await readValidatedBody(
    event,
    z.object({
      plan: z.enum(['PRO', 'PREMIUM', 'CUSTOM']),
      interval: z.enum(['month', 'year']).optional(),
      clientSiteId: z.uuid().optional(),
      origin: z.string(),
      locale: z.string().optional(),
      seats: z.number().int().min(CUSTOM_MIN_SEATS).max(CUSTOM_MAX_SEATS).default(CUSTOM_MIN_SEATS),
    }).parse,
  )
  if (user.role !== 'superadmin') await requireTenantScope(event, 'BILLING_CHANGE', user.clientSiteId)

  const clientSiteId = user.role === 'superadmin' && bodyClientSiteId ? bodyClientSiteId : user.clientSiteId
  if (clientSiteId) await assertBlogNotClosing(clientSiteId, 'This blog is closing')
  if (!plan || !clientSiteId || !origin) {
    throw createError({ statusCode: 400, message: 'Missing required fields' })
  }
  if (!isSubscribablePlan(plan)) {
    throw createError({ statusCode: 400, message: 'Plan not subscribable via Stripe' })
  }

  return withBillingLease(clientSiteId, async (leaseId) => {
    const clientSite = await prisma.clientSite.findUnique({
      where: { id: clientSiteId },
      select: {
        id: true,
        plan: true,
        billingPlan: true,
        billingProvider: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        billingCheckoutId: true,
      },
    })
    if (!clientSite) {
      throw createError({ statusCode: 404, message: 'ClientSite not found' })
    }
    rejectShopifyBilled(event, clientSite.billingProvider)

    const returnUrl = await billingReturnUrl(event, origin, locale, user.language)
    if (bodyInterval !== undefined && !['month', 'year'].includes(bodyInterval))
      throw createError({ statusCode: 400, message: 'Invalid billing interval' })
    const interval: 'month' | 'year' = bodyInterval ?? (clientSite.billingPlan === 'ANNUAL' ? 'year' : 'month')
    const stripe = useStripe()
    if (clientSite.stripeSubscriptionId) {
      const existing = await stripe.subscriptions.retrieve(clientSite.stripeSubscriptionId)
      if (!['canceled', 'incomplete_expired'].includes(existing.status))
        throw createError({
          statusCode: 409,
          message: (await useServerI18n(event)).translate('common.errors.alreadyExists')!,
        })
      await serializableTransaction(async (tx) => {
        await assertBillingLease(tx, clientSiteId, leaseId)
        const changed = await tx.clientSite.updateMany({
          where: { id: clientSiteId, stripeSubscriptionId: existing.id },
          data: { plan: 'BASIC', stripeSubscriptionId: null, stripePriceId: null, paidTeamSeats: null },
        })
        if (changed.count) await syncPlanFeatures(tx, clientSiteId)
      })
      await cancelTranslationLanguageSubscription(clientSiteId)
    }
    const price = await getConfiguredPlanPrice(plan, interval)
    const memberPrice = plan === 'CUSTOM' ? await getConfiguredMemberPrice(interval) : null
    if (!price || (plan === 'CUSTOM' && !memberPrice))
      throw createError({
        statusCode: 503,
        message: (await useServerI18n(event)).translate('common.errTypes.serviceUnavailable')!,
      })
    if (clientSite.billingCheckoutId) {
      const previous = await stripe.checkout.sessions.retrieve(clientSite.billingCheckoutId)
      if (previous.status === 'complete') {
        const previousId = typeof previous.subscription === 'string' ? previous.subscription : previous.subscription?.id
        const previousSubscription = previousId ? await stripe.subscriptions.retrieve(previousId) : null
        if (!previousSubscription || !['canceled', 'incomplete_expired'].includes(previousSubscription.status))
          throw createError({ statusCode: 409, message: 'A completed checkout is still being synchronized' })
      }
      if (previous.status === 'open') {
        await renewBillingLease(clientSiteId, leaseId)
        await stripe.checkout.sessions.expire(previous.id, {}, { timeout: 30_000, maxNetworkRetries: 0 })
      }
    }
    await renewBillingLease(clientSiteId, leaseId)
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        line_items: [
          { price: price.id, quantity: 1 },
          ...(memberPrice ? [{ price: memberPrice.id, quantity: seats - 1 }] : []),
        ],
        success_url: returnUrl,
        cancel_url: returnUrl,
        client_reference_id: clientSiteId,
        customer: clientSite.stripeCustomerId ?? undefined,
        metadata: { plan, clientSiteId, interval },
        subscription_data: {
          metadata: { plan, clientSiteId, interval },
        },
      },
      {
        idempotencyKey: `subscription:${clientSiteId}:${plan}:${interval}:${seats}:${clientSite.billingCheckoutId ?? 'first'}`,
        timeout: 30_000,
        maxNetworkRetries: 0,
      },
    )
    await serializableTransaction(async (tx) => {
      await assertBillingLease(tx, clientSiteId, leaseId)
      await tx.clientSite.update({ where: { id: clientSiteId }, data: { billingCheckoutId: session.id } })
    })
    return { url: session.url }
  })
})

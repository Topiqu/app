const PRICE_BY_PLAN: Record<'PRO' | 'PREMIUM', Record<'month' | 'year', string | undefined>> = {
  PRO: { month: process.env.STRIPE_PRICE_PRO, year: process.env.STRIPE_PRICE_PRO_ANNUAL },
  PREMIUM: { month: process.env.STRIPE_PRICE_PREMIUM, year: process.env.STRIPE_PRICE_PREMIUM_ANNUAL },
}

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
  } = await readBody<{
    plan: 'PRO' | 'PREMIUM'
    interval?: 'month' | 'year'
    clientSiteId?: string
    origin: string
    locale?: string
  }>(event)
  if (user.role !== 'superadmin') await requireTenantScope(event, 'BILLING_CHANGE', user.clientSiteId)

  const clientSiteId = user.role === 'superadmin' && bodyClientSiteId ? bodyClientSiteId : user.clientSiteId
  if (!plan || !clientSiteId || !origin) {
    throw createError({ statusCode: 400, message: 'Missing required fields' })
  }
  if (plan !== 'PRO' && plan !== 'PREMIUM') {
    throw createError({ statusCode: 400, message: 'Plan not subscribable via Stripe' })
  }

  const clientSite = await prisma.clientSite.findUnique({
    where: { id: clientSiteId },
    select: {
      id: true,
      plan: true,
      billingPlan: true,
      billingProvider: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
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
  const price = PRICE_BY_PLAN[plan][interval]
  if (!price) {
    throw createError({ statusCode: 500, message: `Missing Stripe price for ${plan}/${interval}` })
  }

  const stripe = useStripe()
  if (clientSite.stripeSubscriptionId) {
    const existing = await stripe.subscriptions.retrieve(clientSite.stripeSubscriptionId)
    if (!['canceled', 'incomplete_expired'].includes(existing.status))
      throw createError({
        statusCode: 409,
        message: (await useServerI18n(event)).translate('common.errors.alreadyExists')!,
      })
  }
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      success_url: returnUrl,
      cancel_url: returnUrl,
      client_reference_id: clientSiteId,
      customer: clientSite.stripeCustomerId ?? undefined,
      metadata: { plan, clientSiteId, interval },
      subscription_data: {
        metadata: { plan, clientSiteId, interval },
      },
    },
    { idempotencyKey: `subscription:${clientSiteId}:${Math.floor(Date.now() / 1_800_000)}` },
  )

  return { url: session.url }
})

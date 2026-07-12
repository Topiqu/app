const PRICE_BY_PLAN: Record<'PRO' | 'PREMIUM', Record<'month' | 'year', string | undefined>> = {
  PRO: { month: process.env.STRIPE_PRICE_PRO, year: process.env.STRIPE_PRICE_PRO_ANNUAL },
  PREMIUM: { month: process.env.STRIPE_PRICE_PREMIUM, year: process.env.STRIPE_PRICE_PREMIUM_ANNUAL },
}

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const { plan, interval: bodyInterval, clientSiteId: bodyClientSiteId, origin } = await readBody<{
    plan: 'PRO' | 'PREMIUM'
    interval?: 'month' | 'year'
    clientSiteId?: string
    origin: string
  }>(event)

  const clientSiteId = user.role === 'superadmin' && bodyClientSiteId ? bodyClientSiteId : user.clientSiteId
  if (!plan || !clientSiteId || !origin) {
    throw createError({ statusCode: 400, message: 'Missing required fields' })
  }
  if (plan !== 'PRO' && plan !== 'PREMIUM') {
    throw createError({ statusCode: 400, message: 'Plan not subscribable via Stripe' })
  }

  const clientSite = await prisma.clientSite.findUnique({
    where: { id: clientSiteId },
    select: { id: true, plan: true, billingPlan: true, stripeCustomerId: true },
  })
  if (!clientSite) {
    throw createError({ statusCode: 404, message: 'ClientSite not found' })
  }

  const interval: 'month' | 'year' = bodyInterval ?? (clientSite.billingPlan === 'ANNUAL' ? 'year' : 'month')
  const price = PRICE_BY_PLAN[plan][interval]
  if (!price) {
    throw createError({ statusCode: 500, message: `Missing Stripe price for ${plan}/${interval}` })
  }

  const stripe = useStripe()
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price, quantity: 1 }],
    success_url: `${origin}/settings?tab=billing`,
    cancel_url: `${origin}/settings?tab=billing`,
    client_reference_id: clientSiteId,
    customer: clientSite.stripeCustomerId ?? undefined,
    metadata: { plan, clientSiteId, interval },
    subscription_data: {
      metadata: { plan, clientSiteId, interval },
    },
  })

  return { url: session.url }
})

export default defineEventHandler(async (event) => {
  const session = await getSessionUser(event)
  if (!session) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  if (session.role !== 'admin' && session.role !== 'superadmin') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const {
    clientSiteId: bodyClientSiteId,
    origin,
    locale,
  } = await readBody<{
    clientSiteId?: string
    origin: string
    locale?: string
  }>(event)

  // clientSiteId is derived from the session; only a superadmin may act on another site.
  const clientSiteId = session.role === 'superadmin' && bodyClientSiteId ? bodyClientSiteId : session.clientSiteId
  if (session.role !== 'superadmin') await requireTenantScope(event, 'BILLING_CHANGE', clientSiteId)
  if (!clientSiteId || !origin) {
    throw createError({ statusCode: 400, message: 'Missing required fields' })
  }

  const clientSite = await prisma.clientSite.findUnique({
    where: { id: clientSiteId },
    select: { stripeCustomerId: true },
  })
  if (!clientSite?.stripeCustomerId) {
    throw createError({ statusCode: 400, message: 'No active subscription' })
  }

  const stripe = useStripe()
  const returnUrl = await billingReturnUrl(event, origin, locale, session.language)
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: clientSite.stripeCustomerId,
    return_url: returnUrl,
  })

  return { url: portalSession.url }
})

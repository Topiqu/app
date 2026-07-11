import Stripe from 'stripe'

export default defineEventHandler(async (event) => {
  const session = (await getServerSession(event))?.user
  if (!session) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const { clientSiteId: bodyClientSiteId, origin } = await readBody<{
    clientSiteId?: string
    origin: string
  }>(event)

  // clientSiteId is derived from the session; only a superadmin may act on another site.
  const clientSiteId = session.role === 'superadmin' && bodyClientSiteId ? bodyClientSiteId : session.clientSiteId
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

  const stripe = new Stripe(process.env.STRIPE_SK!)
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: clientSite.stripeCustomerId,
    return_url: `${origin}/settings?tab=billing`,
  })

  return { url: portalSession.url }
})

import { getArticlePack } from '~~/shared/utils/articlePacks'

export default defineEventHandler(async (event) => {
  const session = (await getServerSession(event))?.user
  if (!session) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const {
    pack,
    clientSiteId: bodyClientSiteId,
    origin,
  } = await readBody<{
    pack: string
    clientSiteId?: string
    origin: string
  }>(event)

  // clientSiteId is derived from the session; only a superadmin may act on another site.
  const clientSiteId = session.role === 'superadmin' && bodyClientSiteId ? bodyClientSiteId : session.clientSiteId
  if (session.role !== 'superadmin') await requireTenantScope(event, 'BILLING_CHANGE', clientSiteId)
  if (!clientSiteId || !origin) {
    throw createError({ statusCode: 400, message: 'Missing required fields' })
  }

  const site = await prisma.clientSite.findUnique({ where: { id: clientSiteId }, select: { plan: true } })
  if (!site || !hasAiPlan(site.plan)) {
    throw createError({ statusCode: 403, message: 'Article packs require an active AI plan' })
  }

  // Price and article count come from the server-side catalog, never from the client.
  const articlePack = getArticlePack(pack)
  if (!articlePack) {
    throw createError({ statusCode: 400, message: 'Unknown article pack' })
  }

  const stripe = useStripe()
  const stripeSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: articlePack.name },
          unit_amount: Math.round(articlePack.priceUsd * 100),
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/settings?tab=billing`,
    cancel_url: `${origin}/settings?tab=billing`,
    client_reference_id: clientSiteId,
    metadata: { articles: articlePack.articles.toString(), packId: articlePack.id, clientSiteId },
  })
  return { url: stripeSession.url }
})

import { getTokenPack } from '~~/shared/utils/tokenPacks'

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

  // Price and token amount come from the server-side catalog, never from the client.
  const tokenPack = getTokenPack(pack)
  if (!tokenPack) {
    throw createError({ statusCode: 400, message: 'Unknown token pack' })
  }

  const stripe = useStripe()
  const stripeSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: tokenPack.name },
          unit_amount: Math.round(tokenPack.priceUsd * 100),
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/settings?tab=billing`,
    cancel_url: `${origin}/settings?tab=billing`,
    client_reference_id: clientSiteId,
    metadata: { tokens: tokenPack.tokens.toString(), clientSiteId },
  })
  return { url: stripeSession.url }
})

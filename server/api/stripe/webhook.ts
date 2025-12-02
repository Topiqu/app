import Stripe from 'stripe'

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
    const session = stripeEvent.data.object as any

    const tokens = Number(session.metadata.tokens)
    const clientSiteId = session.client_reference_id

    if (tokens > 0 && clientSiteId) {
      await prisma.clientSite.update({
        where: { id: clientSiteId },
        data: {
          tokenRemaining: { increment: tokens },
          totalUsage: { increment: tokens },
        },
      })
    }
  }

  return { received: true }
})

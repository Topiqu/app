import Stripe from 'stripe'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { tokens, priceUsd, name, clientSiteId } = body

  if (!tokens || !priceUsd || !name || !clientSiteId) {
    throw createError({ statusCode: 400, message: 'Missing required fields' })
  }

  const stripe = new Stripe(process.env.STRIPE_SK!)

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name },
          unit_amount: Math.round(priceUsd * 100),
        },
        quantity: 1,
      },
    ],
    success_url: `${body.origin}`,
    cancel_url: `${body.origin}`,
    client_reference_id: clientSiteId,
    metadata: { tokens: tokens.toString() },
  })

  return { url: session.url }
})

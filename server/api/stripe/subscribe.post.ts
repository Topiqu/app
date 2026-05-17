import type { ClientPlan } from '@prisma/client'

import Stripe from 'stripe'

const PRICE_BY_PLAN: Record<Exclude<ClientPlan, 'BASIC' | 'CUSTOM'>, string | undefined> = {
  PRO: process.env.STRIPE_PRICE_PRO,
  PREMIUM: process.env.STRIPE_PRICE_PREMIUM,
}

export default defineEventHandler(async (event) => {
  const { plan, clientSiteId, origin } = await readBody<{
    plan: 'PRO' | 'PREMIUM'
    clientSiteId: string
    origin: string
  }>(event)

  if (!plan || !clientSiteId || !origin) {
    throw createError({ statusCode: 400, message: 'Missing required fields' })
  }
  if (plan !== 'PRO' && plan !== 'PREMIUM') {
    throw createError({ statusCode: 400, message: 'Plan not subscribable via Stripe' })
  }

  const price = PRICE_BY_PLAN[plan]
  if (!price) {
    throw createError({ statusCode: 500, message: `Missing STRIPE_PRICE_${plan} env` })
  }

  const clientSite = await prisma.clientSite.findUnique({
    where: { id: clientSiteId },
    select: { id: true, plan: true, stripeCustomerId: true },
  })
  if (!clientSite) {
    throw createError({ statusCode: 404, message: 'ClientSite not found' })
  }

  const stripe = new Stripe(process.env.STRIPE_SK!)
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price, quantity: 1 }],
    success_url: `${origin}/admin?upgrade=success`,
    cancel_url: `${origin}/admin?upgrade=cancel`,
    client_reference_id: clientSiteId,
    customer: clientSite.stripeCustomerId ?? undefined,
    metadata: { plan, clientSiteId },
    subscription_data: {
      metadata: { plan, clientSiteId },
    },
  })

  return { url: session.url }
})

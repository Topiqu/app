import { z } from 'zod'
import Stripe from 'stripe'

const schema = z.object({
  siteName: z.string().min(1).max(255),
  subdomain: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  language: z.enum(['cs', 'en']),
  username: z.string().min(3).max(50),
  email: z.email(),
  password: z.string().min(4).max(124),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, schema.parse)
  const { translate: t } = await useServerI18n(event)

  const existingSite = await prisma.clientSite.findUnique({ where: { subdomain: body.subdomain } })
  if (existingSite) {
    throw createError({ statusCode: 400, message: t('common.errors.subdomainExists') || 'Subdomain taken' })
  }

  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email: body.email }, { username: body.username }] },
  })
  if (existingUser) {
    throw createError({ statusCode: 400, message: t('common.errors.alreadyExists') || 'User exists' })
  }

  const clientSite = await prisma.clientSite.create({
    data: {
      name: body.siteName,
      subdomain: body.subdomain,
      language: body.language,
      plan: 'PREMIUM',
      tokenRemaining: 25000,
      tokenLimit: 25000,
      enableAi: true,
      enableCron: true,
      enableSentiment: true,
      firstPaidAt: new Date(),
    },
  })

  await saveUserWithLogging(event, {
    username: body.username,
    email: body.email,
    password: body.password,
    role: 'admin',
    clientSiteId: clientSite.id,
    language: body.language,
  })

  const stripeSecret = process.env.STRIPE_SK
  const premiumPriceId = process.env.STRIPE_PREMIUM_PRICE_ID

  if (stripeSecret && premiumPriceId) {
    try {
      const stripe = new Stripe(stripeSecret)

      const customer = await stripe.customers.create({
        email: body.email,
        name: body.username,
        metadata: { clientSiteId: clientSite.id },
      })

      await prisma.clientSite.update({
        where: { id: clientSite.id },
        data: { stripeCustomerId: customer.id },
      })

      const reqUrl = getRequestURL(event)
      const host = reqUrl.host.includes('localhost') ? `localhost:${reqUrl.port}` : reqUrl.host.replace(/^www\./, '')
      const origin = `${reqUrl.protocol}//${body.subdomain}.${host}`

      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [{ price: premiumPriceId, quantity: 1 }],
        subscription_data: { trial_period_days: 14 },
        success_url: `${origin}/autorizace?created=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/autorizace?created=true`,
      })

      return { url: session.url }
    } catch (error) {
      console.error('Stripe error:', error)
    }
  }

  const reqUrl = getRequestURL(event)
  const host = reqUrl.host.includes('localhost') ? `localhost:${reqUrl.port}` : reqUrl.host.replace(/^www\./, '')
  return { url: `${reqUrl.protocol}//${body.subdomain}.${host}/autorizace?created=true` }
})

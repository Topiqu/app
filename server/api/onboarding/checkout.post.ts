import Stripe from 'stripe'
import argon2 from 'argon2'
import { randomBytes } from 'crypto'
import { logAction } from '~~/server/utils/log'
import { saveUserWithLogging } from '~~/server/utils/userLog'
import { verifyVerifiedToken } from '~~/server/utils/onboardingTokens'

const LOGIN_TOKEN_TTL_MS = 5 * 60 * 1000

const schema = z.object({
  siteName: z.string().min(1).max(255),
  domain: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/),
  domainType: z.enum(['SUBDOMAIN', 'CUSTOM']).default('SUBDOMAIN'),
  theme: z.string().optional(),
  language: z.enum(['cs', 'en']),
  username: z.string().min(3).max(50),
  email: z.email(),
  password: z.string().min(8).max(124),
  verifiedToken: z.string().min(1),
  selectedPlan: z.enum(['PRO', 'PREMIUM']).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, schema.parse)
  const { translate: t } = await useServerI18n(event)

  if (!verifyVerifiedToken(body.verifiedToken, body.email)) {
    throw createError({
      statusCode: 400,
      message: t('common.auth.codeExpired') || 'Email not verified. Restart the verification step.',
    })
  }

  const fullSubdomain = body.domainType === 'SUBDOMAIN' ? `${body.domain}.topiqu.com` : body.domain
  const loginToken = randomBytes(32).toString('hex')
  const loginTokenExpiresAt = new Date(Date.now() + LOGIN_TOKEN_TTL_MS)

  const existingSite = await prisma.clientSite.findUnique({ where: { domain: fullSubdomain } })
  if (existingSite) {
    throw createError({ statusCode: 400, message: t('common.errors.subdomainExists') || 'Subdomain taken' })
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: body.email },
  })
  if (existingUser) {
    throw createError({ statusCode: 400, message: t('common.errors.alreadyExists') || 'User exists' })
  }

  let clientSiteId: string
  try {
    const result = await prisma.$transaction(async (tx) => {
      const site = await tx.clientSite.create({
        data: {
          name: body.siteName,
          domain: fullSubdomain,
          language: body.language,
          theme: (body.theme || 'blue') as any,
          domainVerified: body.domainType === 'SUBDOMAIN', // Auto-verify subdomains, custom domains need checking
          plan: 'BASIC', // Will be updated by Stripe Webhook
          tokenRemaining: 25000,
          tokenLimit: 25000,
          enableAi: true,
          enableCron: true,
          enableSentiment: true,
          firstPaidAt: null, // Set in Stripe Webhook
        },
      })

      const hashedPassword = await argon2.hash(body.password)

      await saveUserWithLogging(
        event,
        {
          username: body.username,
          email: body.email,
          password: hashedPassword,
          role: 'admin',
          clientSiteId: site.id,
          language: body.language,
          emailVerified: true,
          onboardingLoginToken: loginToken,
          onboardingLoginTokenExpiresAt: loginTokenExpiresAt,
        },
        false,
        tx,
      )

      return site
    })

    clientSiteId = result.id
  } catch (error: any) {
    console.error('Account creation error:', error)
    if (error.code === 'P2002') {
      throw createError({
        statusCode: 400,
        message: t('common.errors.alreadyExists') || 'Username, email or domain already exists.',
      })
    }
    throw createError({
      statusCode: 500,
      message: t('common.errors.general') || 'Failed to create account. Please try again.',
    })
  }

  const reqUrl = getRequestURL(event)
  const originUrl = process.env.APP_URL || `${reqUrl.protocol}//${fullSubdomain}`
  const dashboardUrl = `${originUrl}/${body.language}/autorizace?created=true&token=${loginToken}`

  if (!body.selectedPlan) {
    return { url: dashboardUrl }
  }

  const stripeSecret = process.env.STRIPE_SK
  const priceId =
    body.selectedPlan === 'PRO' ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_PREMIUM

  if (!stripeSecret || !priceId) {
    return { url: dashboardUrl }
  }

  try {
    const stripe = new Stripe(stripeSecret)

    const customer = await stripe.customers.create({
      email: body.email,
      name: body.username,
      metadata: { clientSiteId },
    })

    await prisma.clientSite.update({
      where: { id: clientSiteId },
      data: { stripeCustomerId: customer.id },
    })

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      client_reference_id: clientSiteId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { plan: body.selectedPlan, clientSiteId },
      },
      metadata: { plan: body.selectedPlan, clientSiteId },
      success_url: `${originUrl}/${body.language}/autorizace?created=true&token=${loginToken}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: dashboardUrl,
    })

    await logAction({
      action: 'STRIPE_CHECKOUT_CREATED',
      clientSiteId,
      metadata: {
        sessionId: session.id,
        customerId: customer.id,
        mode: 'subscription',
        plan: body.selectedPlan,
      },
      ip: getIp(event) || 'unknown',
    })

    return { url: session.url }
  } catch (error) {
    console.error('Stripe error:', error)
    return { url: `${dashboardUrl}&stripe_error=true` }
  }
})

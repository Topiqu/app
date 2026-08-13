import argon2 from 'argon2'
import { randomBytes } from 'crypto'
import { logAction } from '~~/server/utils/log'
import { TRIAL_PLAN } from '~~/shared/utils/trial'
import { saveUserWithLogging } from '~~/server/utils/userLog'
import { verifyVerifiedToken } from '~~/server/utils/onboardingTokens'
import { domainVerificationDefaults, isManagedDomain, isValidDomain, normalizeDomain } from '~~/shared/utils/domain'

const LOGIN_TOKEN_TTL_MS = 30 * 60 * 1000

const schema = z.object({
  siteName: z.string().min(1).max(255),
  domain: z.string().min(1).max(253),
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

  const fullSubdomain = normalizeDomain(body.domainType === 'SUBDOMAIN' ? `${body.domain}.topiqu.com` : body.domain)
  if (!isValidDomain(fullSubdomain)) throw createError({ statusCode: 400, message: 'Invalid domain' })
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
          ...domainVerificationDefaults(fullSubdomain, randomBytes(24).toString('base64url')),
          // The trial is a real plan, not a UI state — `firstPaidAt` stays null as the paid
          // marker, and `trial-expiry` drops a card-less tenant back to BASIC after TRIAL_DAYS.
          plan: TRIAL_PLAN,
          tokenRemaining: 25000,
          tokenLimit: 25000,
          firstPaidAt: null,
        },
      })

      // Crons filter on ClientFeature rows, not on the plan column, so a trial without them
      // would silently skip sentiment and article generation — the parts it exists to show off.
      // Never fatal: `syncPlanFeatures` throws on an unseeded Feature catalog, and signup is the
      // one path that must not depend on it. The plan column alone still unlocks the UI.
      try {
        await syncPlanFeatures(tx, site.id, TRIAL_PLAN)
      } catch (error) {
        console.error('TRIAL_FEATURE_PROVISIONING_FAILED', site.id, error)
      }

      const hashedPassword = await argon2.hash(body.password)

      const user = await saveUserWithLogging(
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
      await tx.tenantMembership.create({ data: { clientSiteId: site.id, userId: user.id, role: 'OWNER', scopes: [...TENANT_SCOPES] } })

      if (!isManagedDomain(site.domain))
        await logAction({
          action: 'DOMAIN_VERIFICATION_STARTED',
          userId: user.id,
          clientSiteId: site.id,
          ip: getIp(event),
          metadata: { domain: site.domain },
          tx,
        })

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
  const priceId = body.selectedPlan === 'PRO' ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_PREMIUM

  if (!stripeSecret || !priceId) {
    return { url: dashboardUrl }
  }

  try {
    const stripe = useStripe()

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

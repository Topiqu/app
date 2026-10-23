import { z } from 'zod'
import argon2 from 'argon2'
import { randomBytes } from 'crypto'

const LOGIN_TOKEN_TTL_MS = 30 * 60 * 1000
const SIGNUPS_PER_IP_PER_DAY = 10
const PRICE_BY_PLAN = {
  PRO: { month: process.env.STRIPE_PRICE_PRO, year: process.env.STRIPE_PRICE_PRO_ANNUAL },
  PREMIUM: { month: process.env.STRIPE_PRICE_PREMIUM, year: process.env.STRIPE_PRICE_PREMIUM_ANNUAL },
} as const
const ANNUAL_PRICE_CENTS = { PRO: 47040, PREMIUM: 95040 } as const

const schema = z.object({
  siteName: z.string().min(1).max(255),
  domain: z.string().min(1).max(253),
  domainType: z.enum(['SUBDOMAIN', 'CUSTOM']).default('SUBDOMAIN'),
  theme: z.string().optional(),
  // Branding chosen in the landing wizard; custom font files need the site to exist, so they are not accepted here.
  accentColor: z.string().optional(),
  brandGradient: z.unknown().optional(),
  typographyPreset: z.enum(['MODERN', 'EDITORIAL', 'MAGAZINE', 'SYSTEM']).optional(),
  tagline: z.string().trim().max(80).optional(),
  language: z.enum(LANGUAGE_OPTIONS),
  username: z.string().min(3).max(50),
  email: z.email(),
  password: z.string().min(8).max(124),
  verifiedToken: z.string().min(1),
  selectedPlan: z.enum(['PRO', 'PREMIUM']).nullable().optional(),
  billingInterval: z.enum(['month', 'year']).default('month'),
  // Not `website`: that name is the landing's bot honeypot.
  websiteUrl: z.string().trim().max(2048).optional(),
})

/** Only a valid http(s) address is kept; a typo must not cost the visitor their sign-up. */
const websiteUrl = (raw?: string) => {
  if (!raw) return null
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.') ? url.href : null
  } catch {
    return null
  }
}

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, schema.parse)
  const { translate: t } = await useServerI18n(event)

  if (!verifyVerifiedToken(body.verifiedToken, body.email)) {
    throw createError({
      statusCode: 400,
      message: t('common.auth.codeExpired') || 'Email not verified. Restart the verification step.',
    })
  }

  if (isDisposableEmail(body.email)) {
    throw createError({
      statusCode: 400,
      message: t('common.auth.disposableEmail') || 'Disposable email addresses are not allowed',
    })
  }

  const priceId = body.selectedPlan ? PRICE_BY_PLAN[body.selectedPlan][body.billingInterval] : undefined

  // The landing advertises a 20% annual discount on $49/$99 monthly plans.
  // Check the deployed Stripe catalog before creating an account or a Checkout session.
  if (body.selectedPlan && body.billingInterval === 'year') {
    if (!process.env.STRIPE_SK || !priceId) {
      throw createError({ statusCode: 503, message: 'Annual billing is temporarily unavailable.' })
    }
    let annualPrice
    try {
      annualPrice = await useStripe().prices.retrieve(priceId)
    } catch {
      throw createError({ statusCode: 503, message: 'Annual billing is temporarily unavailable.' })
    }
    const expectedAmount = ANNUAL_PRICE_CENTS[body.selectedPlan]
    if (
      !annualPrice.active ||
      annualPrice.currency !== 'usd' ||
      annualPrice.recurring?.interval !== 'year' ||
      annualPrice.unit_amount !== expectedAmount
    ) {
      throw createError({ statusCode: 503, message: 'Annual billing is temporarily unavailable.' })
    }
  }

  const fullSubdomain = normalizeDomain(body.domainType === 'SUBDOMAIN' ? `${body.domain}.topiqu.com` : body.domain)
  // Every onboarding tenant starts on the trial plan, which includes a custom domain.
  if (domainError(fullSubdomain, { allowCustom: true }))
    throw createError({ statusCode: 400, message: 'Invalid domain' })
  const loginToken = randomBytes(32).toString('hex')
  const loginTokenExpiresAt = new Date(Date.now() + LOGIN_TOKEN_TTL_MS)

  if (await isDomainTaken(fullSubdomain)) {
    throw createError({ statusCode: 400, message: t('common.errors.subdomainExists') || 'Subdomain taken' })
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: body.email },
  })
  if (existingUser) {
    throw createError({ statusCode: 400, message: t('common.errors.alreadyExists') || 'User exists' })
  }

  // Counted only once a request reaches account creation; failed validation above costs nothing.
  const signupIp = landingClientIp(event) ?? getIp(event)
  if (!(await consumeRateLimit(`signup:${pepperIp(signupIp)}`, SIGNUPS_PER_IP_PER_DAY, 86400))) {
    throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests') || 'Too many requests' })
  }

  let clientSiteId: string
  let trial = true
  const trialStartedAt = new Date()
  const trialEndsAt = new Date(trialStartedAt.getTime() + TRIAL_DAYS * 86400000)
  try {
    const result = await prisma.$transaction(async (tx) => {
      // A repeat inbox (alias or re-registration) still gets an account, just not another trial.
      trial = !(await inboxOwnsSite(tx, body.email))
      const site = await tx.clientSite.create({
        data: {
          name: body.siteName,
          domain: fullSubdomain,
          language: body.language,
          theme: (body.theme || 'blue') as any,
          accentColor: normalizeAccentColor(body.accentColor),
          brandGradient: parseBrandGradient(body.brandGradient) ?? undefined,
          typographyPreset: body.typographyPreset ?? 'MODERN',
          tagline: body.tagline || null,
          websiteUrl: websiteUrl(body.websiteUrl),
          ...domainVerificationDefaults(fullSubdomain, randomBytes(24).toString('base64url')),
          // The trial is a real plan, not a UI state — `firstPaidAt` stays null as the paid
          // marker, and `trial-expiry` drops a card-less tenant back to BASIC after TRIAL_DAYS.
          plan: trial ? TRIAL_PLAN : 'BASIC',
          trialStartedAt: trial ? trialStartedAt : null,
          trialEndsAt: trial ? trialEndsAt : null,
          firstPaidAt: null,
        },
      })

      if (trial)
        await creditArticleCredits(
          {
            clientSiteId: site.id,
            amount: TRIAL_ARTICLE_CREDITS,
            source: 'TRIAL',
            idempotencyKey: `trial:${site.id}`,
            reason: 'Welcome trial articles',
            expiresAt: trialEndsAt,
          },
          tx,
        )

      // Crons filter on ClientFeature rows, not on the plan column, so a trial without them
      // would silently skip sentiment and article generation — the parts it exists to show off.
      // Never fatal: `syncPlanFeatures` throws on an unseeded Feature catalog, and signup is the
      // one path that must not depend on it. The plan column alone still unlocks the UI.
      try {
        await syncPlanFeatures(tx, site.id)
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
      await tx.tenantMembership.create({
        data: { clientSiteId: site.id, userId: user.id, role: 'OWNER', scopes: [...TENANT_SCOPES] },
      })

      if (!trial)
        await logAction({ action: 'TRIAL_REPEAT_INBOX', userId: user.id, clientSiteId: site.id, ip: signupIp, tx })

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
    if (isUniqueViolation(error)) {
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
  const dashboardUrl = `${originUrl}${authPath(body.language)}?created=true&token=${loginToken}`

  if (!body.selectedPlan) {
    return { url: dashboardUrl }
  }

  const stripeSecret = process.env.STRIPE_SK
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
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        ...(trial && { trial_period_days: 14 }),
        metadata: { plan: body.selectedPlan, clientSiteId, interval: body.billingInterval },
      },
      metadata: { plan: body.selectedPlan, clientSiteId, interval: body.billingInterval },
      success_url: `${dashboardUrl}&session_id={CHECKOUT_SESSION_ID}`,
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
        interval: body.billingInterval,
      },
      ip: getIp(event) || 'unknown',
    })

    return { url: session.url }
  } catch (error) {
    console.error('Stripe error:', error)
    return { url: `${dashboardUrl}&stripe_error=true` }
  }
})

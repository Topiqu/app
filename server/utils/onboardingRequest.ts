import type { H3Event } from 'h3'
import type { ModelResult } from '@zenstackhq/orm'
import type { SchemaType } from '~~/generated/zenstack/schema'
import type { SubscribablePlan } from '~~/shared/types/planPricing'

import { createHmac, randomUUID } from 'node:crypto'

const LEASE_MS = 2 * 60_000
// Stripe retains idempotency keys for at least 24 hours; do not repeat an uncertain mutation later.
const SAFE_STRIPE_RETRY_MS = 23 * 60 * 60_000
type SignupBilling = {
  email: string
  username: string
  selectedPlan?: SubscribablePlan | null
  billingInterval: 'month' | 'year'
}
// Explicit internal selection includes omitted fields without making the model publicly readable.
const stateSelect = {
  id: true,
  identityHash: true,
  keyHash: true,
  fingerprint: true,
  clientSiteId: true,
  userId: true,
  returnUrl: true,
  priceId: true,
  memberPriceId: true,
  trial: true,
  trialEndsAt: true,
  customerStartedAt: true,
  checkoutStartedAt: true,
  stripeCheckoutId: true,
  completedAt: true,
  leaseId: true,
  leaseUntil: true,
  createdAt: true,
  updatedAt: true,
} as const
type StoredRequest = ModelResult<SchemaType, 'OnboardingRequest', { select: typeof stateSelect }>
type Attempt = StoredRequest & { leaseId: string; loginToken: string }

const digest = (purpose: string, value: string) => {
  const secret = process.env.AUTH_SECRET || useRuntimeConfig().auth.secret
  if (!secret) throw new Error('Onboarding signing secret is missing')
  return createHmac('sha256', secret).update(`onboarding:${purpose}:v1:${value}`).digest('hex')
}
const retry = () => createError({ statusCode: 503, data: { code: 'ONBOARDING_RETRY' } })
const conflict = () =>
  createError({
    statusCode: 409,
    data: { code: 'ONBOARDING_CONFLICT' },
  })

/** A verified request owns one durable identity; its payload digest includes the password, never the proof. */
export const withOnboardingRequest = async <T>(
  event: H3Event,
  body: Record<string, unknown> & { email: string; verifiedToken: string },
  run: (attempt: Attempt) => Promise<T>,
): Promise<T> => {
  const identityHash = digest('identity', body.email.trim().toLowerCase())
  if (!(await consumeRateLimit(`onboarding-retry:${identityHash}`, 20, 60))) throw createError({ statusCode: 429 })
  const suppliedKey = getHeader(event, 'idempotency-key')
  if (suppliedKey && !/^[a-zA-Z0-9_.:-]{8,200}$/.test(suppliedKey)) throw createError({ statusCode: 400 })
  const keyHash = digest('key', suppliedKey ?? identityHash)
  const fingerprint = digest(
    'payload',
    JSON.stringify(Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'verifiedToken'))),
  )
  let stored: StoredRequest
  try {
    stored = await prisma.onboardingRequest.upsert({
      where: { identityHash },
      update: {},
      create: { identityHash, keyHash, fingerprint },
      select: stateSelect,
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict()
    throw error
  }
  if (stored.fingerprint !== fingerprint || stored.keyHash !== keyHash) {
    // A crashed validation before account creation has no remote side effects to preserve.
    const corrected = await prisma.onboardingRequest
      .updateMany({
        where: {
          id: stored.id,
          clientSiteId: null,
          OR: [{ leaseUntil: null }, { leaseUntil: { lte: new Date() } }],
        },
        data: { fingerprint, keyHash },
      })
      .catch((error) => {
        if (isUniqueViolation(error)) throw conflict()
        throw error
      })
    if (!corrected.count) throw conflict()
  }
  const leaseId = randomUUID()
  const claimed = await prisma.onboardingRequest.updateMany({
    where: {
      id: stored.id,
      fingerprint,
      keyHash,
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: new Date() } }],
    },
    data: { leaseId, leaseUntil: new Date(Date.now() + LEASE_MS) },
  })
  if (!claimed.count) throw retry()
  const current = await prisma.onboardingRequest.findUniqueOrThrow({ where: { id: stored.id }, select: stateSelect })
  const attempt: Attempt = { ...current, leaseId, loginToken: digest('login', stored.id) }
  try {
    return await run(attempt)
  } catch (error) {
    // Account creation and this link commit together. A failed pre-account validation may be corrected.
    await prisma.onboardingRequest
      .deleteMany({ where: { id: attempt.id, leaseId, clientSiteId: null } })
      .catch((failure) => reportCaughtError('Onboarding validation cleanup failed', failure, { requestId: attempt.id }))
    throw error
  } finally {
    await prisma.onboardingRequest
      .updateMany({ where: { id: attempt.id, leaseId }, data: { leaseId: null, leaseUntil: null } })
      .catch((error) => reportCaughtError('Onboarding lease release failed', error, { requestId: attempt.id }))
  }
}

/** Locks and fences the attempt before committing account or billing state. No provider calls in the transaction. */
export const assertOnboardingRequest = async (tx: DatabaseTransaction, attempt: Attempt) => {
  const current = await tx.onboardingRequest.updateMany({
    where: { id: attempt.id, leaseId: attempt.leaseId, leaseUntil: { gt: new Date() } },
    data: { leaseUntil: new Date(Date.now() + LEASE_MS) },
  })
  if (!current.count) throw retry()
}

/** Continue the original signup, reusing Stripe mutation keys and the original single-use login token. */
export const finishOnboardingCheckout = async (attempt: Attempt, body: SignupBilling): Promise<{ url: string }> => {
  if (!attempt.clientSiteId || !attempt.userId || !attempt.returnUrl) throw retry()
  const clientSiteId = attempt.clientSiteId
  const user = await prisma.user.findFirst({
    where: { id: attempt.userId, deletedAt: null },
    select: { onboardingLoginToken: true, onboardingLoginTokenExpiresAt: true },
  })
  if (!user) throw createError({ statusCode: 410 })
  const dashboard = new URL(attempt.returnUrl)
  if (
    user.onboardingLoginToken === attempt.loginToken &&
    user.onboardingLoginTokenExpiresAt &&
    user.onboardingLoginTokenExpiresAt > new Date()
  )
    dashboard.searchParams.set('token', attempt.loginToken)
  const dashboardResult = { url: dashboard.href }
  if (!body.selectedPlan || !attempt.priceId || !process.env.STRIPE_SK) return dashboardResult

  return withBillingLease(clientSiteId, async (billingLeaseId) => {
    const site = await prisma.clientSite.findFirst({
      where: { id: clientSiteId, deletedAt: null },
      select: { stripeCustomerId: true, stripeSubscriptionId: true, billingCheckoutId: true },
    })
    if (!site) throw createError({ statusCode: 410 })
    if (site.stripeSubscriptionId) return dashboardResult
    // A signed-in billing action supersedes signup recovery, including an expired old Checkout.
    if (site.billingCheckoutId && site.billingCheckoutId !== attempt.stripeCheckoutId) return dashboardResult
    const stripe = useStripe()
    if (attempt.stripeCheckoutId) {
      const session = await stripe.checkout.sessions.retrieve(
        attempt.stripeCheckoutId,
        {},
        { timeout: 30_000, maxNetworkRetries: 0 },
      )
      return session.status === 'open' && session.url ? { url: session.url } : dashboardResult
    }
    const unsafeToRepeat = [attempt.customerStartedAt, attempt.checkoutStartedAt].some(
      (at) => at && Date.now() - at.getTime() >= SAFE_STRIPE_RETRY_MS,
    )
    if (unsafeToRepeat) return dashboardResult
    // Checkout requires at least 48 hours. A late recovery must never restart or extend the original trial.
    const trialEnd = attempt.trial && body.selectedPlan !== 'CUSTOM' ? attempt.trialEndsAt : null
    if (
      attempt.trial &&
      body.selectedPlan !== 'CUSTOM' &&
      (!trialEnd || trialEnd.getTime() <= Date.now() + 48 * 60 * 60_000)
    )
      return dashboardResult
    const price = await getConfiguredPlanPrice(body.selectedPlan!, body.billingInterval)
    const member = body.selectedPlan === 'CUSTOM' ? await getConfiguredMemberPrice(body.billingInterval) : null
    if (!price || (body.selectedPlan === 'CUSTOM' && !member)) throw retry()
    if (price.id !== attempt.priceId || (member?.id ?? null) !== attempt.memberPriceId) return dashboardResult

    const save = async (
      data: Partial<
        Pick<StoredRequest, 'customerStartedAt' | 'checkoutStartedAt' | 'stripeCheckoutId' | 'completedAt'>
      >,
      client: { stripeCustomerId?: string; billingCheckoutId?: string } = {},
    ) => {
      const updated = await prisma.$transaction(async (tx) => {
        await assertOnboardingRequest(tx, attempt)
        await assertBillingLease(tx, clientSiteId, billingLeaseId)
        if (Object.keys(client).length) await tx.clientSite.update({ where: { id: clientSiteId }, data: client })
        return tx.onboardingRequest.update({ where: { id: attempt.id }, data, select: stateSelect })
      })
      Object.assign(attempt, updated, { leaseId: attempt.leaseId })
    }
    try {
      let customerId = site.stripeCustomerId
      if (!customerId) {
        await save({ customerStartedAt: attempt.customerStartedAt ?? new Date() })
        await renewBillingLease(clientSiteId, billingLeaseId)
        const customer = await stripe.customers.create(
          { email: body.email, name: body.username, metadata: { clientSiteId, onboardingRequestId: attempt.id } },
          { idempotencyKey: `onboarding:${attempt.id}:customer`, timeout: 30_000, maxNetworkRetries: 0 },
        )
        customerId = customer.id
        await save({}, { stripeCustomerId: customerId })
      }
      await save({ checkoutStartedAt: attempt.checkoutStartedAt ?? new Date() })
      await renewBillingLease(clientSiteId, billingLeaseId)
      const originalReturn = new URL(attempt.returnUrl!)
      originalReturn.searchParams.set('token', attempt.loginToken)
      const session = await stripe.checkout.sessions.create(
        {
          customer: customerId,
          client_reference_id: clientSiteId,
          mode: 'subscription',
          line_items: [
            { price: attempt.priceId!, quantity: 1 },
            ...(attempt.memberPriceId ? [{ price: attempt.memberPriceId, quantity: 2 }] : []),
          ],
          subscription_data: {
            ...(trialEnd ? { trial_end: Math.floor(trialEnd.getTime() / 1000) } : {}),
            metadata: { plan: body.selectedPlan!, clientSiteId, interval: body.billingInterval },
          },
          metadata: { plan: body.selectedPlan!, clientSiteId, interval: body.billingInterval },
          success_url: `${originalReturn.href}&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: originalReturn.href,
        },
        { idempotencyKey: `onboarding:${attempt.id}:checkout`, timeout: 30_000, maxNetworkRetries: 0 },
      )
      if (!session.url) throw retry()
      await save({ stripeCheckoutId: session.id, completedAt: new Date() }, { billingCheckoutId: session.id })
      await logAction({
        action: 'STRIPE_CHECKOUT_CREATED',
        clientSiteId,
        metadata: {
          sessionId: session.id,
          customerId,
          mode: 'subscription',
          plan: body.selectedPlan,
          interval: body.billingInterval,
        },
      })
      return { url: session.url }
    } catch (error) {
      await reportCaughtError('Onboarding Stripe continuation failed', error, { requestId: attempt.id, clientSiteId })
      throw retry()
    }
  })
}

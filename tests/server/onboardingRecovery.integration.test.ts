// @vitest-environment node
import Stripe from 'stripe'
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { PolicyPlugin } from '@zenstackhq/plugin-policy'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../helpers/nitroImports'
import { createDatabaseClient } from '../../server/utils/database'

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const sandboxKey = process.env.STRIPE_SK
const sandboxPrice = process.env.STRIPE_PRICE_PRO
vi.stubGlobal('createDatabaseClient', createDatabaseClient)
const { appMutationPlugin } = await import('../../server/utils/prisma')
const db = enabled ? createDatabaseClient(url).$use(appMutationPlugin) : null
const stripe = {
  customers: { create: vi.fn() },
  checkout: { sessions: { create: vi.fn(), retrieve: vi.fn() } },
  subscriptions: { retrieve: vi.fn() },
}
const event = () => {
  const id = randomUUID()
  return {
    headers: { 'idempotency-key': id.replaceAll('-', '').repeat(2) },
    body: {
      siteName: `Recovery ${id}`,
      domain: `recovery-${id}`,
      language: 'en',
      username: `owner-${id}`,
      email: `${id}@example.test`,
      password: 'Synthetic-only-password-98!',
      verifiedToken: 'synthetic-verified-proof',
      selectedPlan: 'PRO',
      billingInterval: 'month',
    },
  }
}

describe.skipIf(!enabled)('durable onboarding recovery on PostgreSQL', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubGlobal('prisma', db)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('defineEventHandler', (run: unknown) => run)
    vi.stubGlobal('readValidatedBody', async (e: ReturnType<typeof event>, parse: (value: unknown) => unknown) =>
      parse(e.body),
    )
    vi.stubGlobal('getHeader', (e: ReturnType<typeof event>, key: string) => e.headers[key as 'idempotency-key'])
    vi.stubGlobal('getRequestURL', () => new URL('https://app.example.test/api/onboarding/checkout'))
    vi.stubGlobal('useRuntimeConfig', () => ({ auth: { secret: process.env.AUTH_SECRET } }))
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('getIp', () => '203.0.113.8')
    vi.stubGlobal('pepperIp', (ip: string) => ip)
    vi.stubGlobal('consumeRateLimit', async () => true)
    vi.stubGlobal('verifyVerifiedToken', () => true)
    vi.stubGlobal('landingClientIp', () => '203.0.113.8')
    vi.stubGlobal('isDisposableEmail', () => false)
    vi.stubGlobal('isDomainTaken', async () => false)
    vi.stubGlobal('ensureAiAuthor', async () => ({ id: 'synthetic-ai' }))
    vi.stubGlobal('TENANT_SCOPES', ['TENANT_SETTINGS', 'BILLING_CHANGE'])
    vi.stubGlobal('isUniqueViolation', () => false)
    vi.stubGlobal('syncPlanFeatures', vi.fn())
    vi.stubGlobal('logAction', vi.fn())
    vi.stubGlobal('reportCaughtError', vi.fn())
    vi.stubGlobal('getConfiguredPlanPrice', async () => ({ id: 'price_pro_fixture' }))
    vi.stubGlobal('useStripe', () => stripe)
    await stubNitroImports(import('../../server/utils/userLog'), 'saveUserWithLogging')
    await stubNitroImports(import('../../server/utils/trialInbox'), 'inboxOwnsSite')
    await stubNitroImports(import('../../shared/utils/articleCredits'), 'ARTICLE_CREDIT_POLICY_VERSION')
    await stubNitroImports(import('../../server/utils/articleCreditWallet'), 'creditArticleCredits')
    await stubNitroImports(
      import('../../server/utils/onboardingRequest'),
      'withOnboardingRequest',
      'assertOnboardingRequest',
      'finishOnboardingCheckout',
    )
    await stubNitroImports(
      import('../../server/utils/customBilling'),
      'withBillingLease',
      'assertBillingLease',
      'renewBillingLease',
    )
    await stubNitroImports(import('../../server/utils/databaseError'), 'isUniqueViolation')
    stripe.customers.create.mockResolvedValue({ id: 'cus_recovery_fixture' })
    stripe.checkout.sessions.create.mockResolvedValue({
      id: 'cs_recovery_fixture',
      url: 'https://checkout.example.test/recovered',
      status: 'open',
    })
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_recovery_fixture',
      url: 'https://checkout.example.test/recovered',
      status: 'open',
    })
    vi.stubEnv('STRIPE_SK', 'sk_test_synthetic')
    vi.stubEnv('APP_URL', 'https://app.example.test')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
  afterAll(async () => db?.$disconnect())

  it('resumes the same account after Stripe creation timed out instead of rejecting the retry as an existing user', async () => {
    const e = event()
    stripe.customers.create.mockRejectedValueOnce(new Error('Synthetic timeout after customer creation'))
    const route = (await import('../../server/api/onboarding/checkout.post')).default
    await route(e as never).catch(() => undefined)
    await expect(route(e as never)).resolves.toMatchObject({ url: 'https://checkout.example.test/recovered' })
    expect(await db!.user.count({ where: { email: e.body.email } })).toBe(1)
    expect(await db!.clientSite.count({ where: { name: e.body.siteName } })).toBe(1)
    const calls = stripe.customers.create.mock.calls
    expect(calls[0]![1].idempotencyKey).toBe(calls[1]![1].idempotencyKey)
    expect(calls[0]![0]).toEqual(calls[1]![0])
    const site = await db!.clientSite.findUniqueOrThrow({ where: { name: e.body.siteName } })
    expect(await db!.articleCreditGrant.count({ where: { clientSiteId: site.id, source: 'TRIAL' } })).toBe(1)
  })

  it('reuses a checkout after its response was lost before it could be saved', async () => {
    const e = event()
    stripe.checkout.sessions.create.mockRejectedValueOnce(new Error('Synthetic timeout after checkout creation'))
    const route = (await import('../../server/api/onboarding/checkout.post')).default
    await expect(route(e as never)).rejects.toMatchObject({ statusCode: 503 })
    await expect(route(e as never)).resolves.toHaveProperty('url', 'https://checkout.example.test/recovered')
    expect(stripe.customers.create).toHaveBeenCalledOnce()
    const calls = stripe.checkout.sessions.create.mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[0]![0]).toEqual(calls[1]![0])
    expect(calls[0]![1].idempotencyKey).toBe(calls[1]![1].idempotencyKey)
  })

  it('replays from a separate database client without another user, customer or checkout', async () => {
    const e = event()
    const route = (await import('../../server/api/onboarding/checkout.post')).default
    const first = await route(e as never)
    const secondWorker = createDatabaseClient(url).$use(appMutationPlugin)
    try {
      vi.stubGlobal('prisma', secondWorker)
      vi.stubGlobal('isDomainTaken', async () => true)
      expect(await route(e as never)).toEqual(first)
    } finally {
      await secondWorker.$disconnect()
      vi.stubGlobal('prisma', db)
    }
    expect(stripe.customers.create).toHaveBeenCalledOnce()
    expect(stripe.checkout.sessions.create).toHaveBeenCalledOnce()
    expect(await db!.user.count({ where: { email: e.body.email } })).toBe(1)
  })

  it('keeps the original trial deadline across recovery and never restarts a nearly expired trial', async () => {
    const e = event()
    stripe.checkout.sessions.create.mockRejectedValueOnce(new Error('Synthetic lost checkout response'))
    const route = (await import('../../server/api/onboarding/checkout.post')).default
    await expect(route(e as never)).rejects.toMatchObject({ statusCode: 503 })
    const site = await db!.clientSite.findUniqueOrThrow({ where: { name: e.body.siteName } })
    expect(stripe.checkout.sessions.create.mock.calls[0]![0].subscription_data.trial_end).toBe(
      Math.floor(site.trialEndsAt!.getTime() / 1000),
    )
    await db!.onboardingRequest.update({
      where: { clientSiteId: site.id },
      data: { trialEndsAt: new Date(Date.now() + 24 * 60 * 60_000) },
    })
    expect((await route(e as never)).url).toContain('/en/auth')
    expect(stripe.checkout.sessions.create).toHaveBeenCalledOnce()
  })

  it('serializes simultaneous signup attempts while the first provider request is in flight', async () => {
    const e = event()
    let release!: () => void
    let entered!: () => void
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    stripe.customers.create.mockImplementationOnce(async () => {
      entered()
      await pending
      return { id: 'cus_pending_fixture' }
    })
    const route = (await import('../../server/api/onboarding/checkout.post')).default
    const first = route(e as never)
    try {
      await started
      await expect(route(e as never)).rejects.toMatchObject({ statusCode: 503, data: { code: 'ONBOARDING_RETRY' } })
    } finally {
      release()
      await first
    }
    expect(await db!.user.count({ where: { email: e.body.email } })).toBe(1)
    expect(stripe.customers.create).toHaveBeenCalledOnce()
  })

  it('requires the original payload and proof before returning a saved result', async () => {
    const e = event()
    const route = (await import('../../server/api/onboarding/checkout.post')).default
    await route(e as never)
    await expect(
      route({ ...e, body: { ...e.body, password: 'Different-password-98!' } } as never),
    ).rejects.toMatchObject({ statusCode: 409 })
    vi.stubGlobal('verifyVerifiedToken', () => false)
    await expect(route(e as never)).rejects.toMatchObject({ statusCode: 400 })
    expect(stripe.checkout.sessions.create).toHaveBeenCalledOnce()
  })

  it('allows renewed email proof while keeping the original operation and provider keys', async () => {
    const e = event()
    const route = (await import('../../server/api/onboarding/checkout.post')).default
    const first = await route(e as never)
    const next = { ...e, body: { ...e.body, verifiedToken: 'renewed-synthetic-proof' } }
    expect(await route(next as never)).toEqual(first)
    expect(stripe.checkout.sessions.create).toHaveBeenCalledOnce()
  })

  it('does not let another verified inbox reuse an existing idempotency key', async () => {
    const e = event()
    const route = (await import('../../server/api/onboarding/checkout.post')).default
    await route(e as never)
    const other = { ...event(), headers: e.headers }
    await expect(route(other as never)).rejects.toMatchObject({ statusCode: 409 })
    expect(await db!.user.count({ where: { email: other.body.email } })).toBe(0)
  })

  it('never remints a consumed or expired onboarding login token', async () => {
    const e = event()
    const free = { ...e, body: { ...e.body, selectedPlan: null } }
    const route = (await import('../../server/api/onboarding/checkout.post')).default
    const first = await route(free as never)
    expect(new URL(first.url).searchParams.get('token')).toMatch(/^[a-f0-9]{64}$/)
    await db!.user.update({
      where: { email: e.body.email },
      data: { onboardingLoginToken: null, onboardingLoginTokenExpiresAt: null },
    })
    expect(new URL((await route(free as never)).url).searchParams.has('token')).toBe(false)
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('returns sign-in instead of creating another checkout when the original session expires', async () => {
    const e = event()
    const route = (await import('../../server/api/onboarding/checkout.post')).default
    await route(e as never)
    stripe.checkout.sessions.retrieve.mockResolvedValueOnce({ status: 'expired' })
    expect((await route(e as never)).url).toContain('/en/auth')
    expect(stripe.checkout.sessions.create).toHaveBeenCalledOnce()
  })

  it('does not replace a checkout started later from the signed-in billing page', async () => {
    const e = event()
    stripe.customers.create.mockRejectedValueOnce(new Error('Synthetic interrupted signup billing'))
    const route = (await import('../../server/api/onboarding/checkout.post')).default
    await expect(route(e as never)).rejects.toMatchObject({ statusCode: 503 })
    const site = await db!.clientSite.findUniqueOrThrow({ where: { name: e.body.siteName } })
    await db!.clientSite.update({ where: { id: site.id }, data: { billingCheckoutId: 'cs_signed_in_checkout' } })
    expect((await route(e as never)).url).toContain('/en/auth')
    expect(stripe.customers.create).toHaveBeenCalledOnce()
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
    const current = await db!.clientSite.findUniqueOrThrow({
      where: { id: site.id },
      select: { billingCheckoutId: true },
    })
    expect(current.billingCheckoutId).toBe('cs_signed_in_checkout')
  })

  it('recovers an expired worker lease and rejects its subsequent local write', async () => {
    const e = event()
    stripe.customers.create.mockRejectedValueOnce(new Error('Synthetic interruption'))
    const route = (await import('../../server/api/onboarding/checkout.post')).default
    await expect(route(e as never)).rejects.toMatchObject({ statusCode: 503 })
    const site = await db!.clientSite.findUniqueOrThrow({ where: { name: e.body.siteName } })
    const saved = await db!.onboardingRequest.findUniqueOrThrow({
      where: { clientSiteId: site.id },
      select: { id: true },
    })
    await db!.onboardingRequest.update({
      where: { id: saved.id },
      data: { leaseId: 'expired-worker', leaseUntil: new Date(Date.now() - 1) },
    })
    await expect(route(e as never)).resolves.toHaveProperty('url')
    await expect(
      db!.$transaction((tx) => assertOnboardingRequest(tx, { id: saved.id, leaseId: 'expired-worker' } as never)),
    ).rejects.toMatchObject({ statusCode: 503 })
  })

  it('stops automatic provider mutation retries before Stripe can expire its idempotency key', async () => {
    const e = event()
    stripe.customers.create.mockRejectedValueOnce(new Error('Synthetic uncertain customer'))
    const route = (await import('../../server/api/onboarding/checkout.post')).default
    await expect(route(e as never)).rejects.toMatchObject({ statusCode: 503 })
    const site = await db!.clientSite.findUniqueOrThrow({ where: { name: e.body.siteName } })
    await db!.onboardingRequest.update({
      where: { clientSiteId: site.id },
      data: { customerStartedAt: new Date(Date.now() - 24 * 60 * 60_000) },
    })
    expect((await route(e as never)).url).toContain('/en/auth')
    expect(stripe.customers.create).toHaveBeenCalledOnce()
  })

  it('keeps recovery records system-only and persists neither passwords, proofs nor bearer URLs', async () => {
    const e = event()
    const route = (await import('../../server/api/onboarding/checkout.post')).default
    await route(e as never)
    const site = await db!.clientSite.findUniqueOrThrow({ where: { name: e.body.siteName } })
    const saved = await db!.onboardingRequest.findUniqueOrThrow({
      where: { clientSiteId: site.id },
      select: { fingerprint: true, keyHash: true, returnUrl: true },
    })
    const json = JSON.stringify(saved)
    expect(json).not.toContain(e.body.password)
    expect(json).not.toContain(e.body.verifiedToken)
    expect(saved.returnUrl).not.toContain('token=')
    expect(await db!.$use(new PolicyPlugin()).$setAuth(undefined).onboardingRequest.findMany()).toEqual([])
  })

  it.skipIf(process.env.STRIPE_SANDBOX_VERIFY !== '1')(
    'recovers a real sandbox customer after a lost response and reuses one real Checkout',
    async () => {
      if (!/^(sk|rk)_test_/.test(sandboxKey ?? '') || !sandboxPrice)
        throw new Error('Explicit sandbox key and Price required')
      const provider = new Stripe(sandboxKey!, { apiVersion: '2025-08-27.basil' as Stripe.LatestApiVersion })
      if ((await provider.balance.retrieve()).livemode) throw new Error('Live Stripe access refused')
      const e = event()
      const customers = new Set<string>()
      let checkoutId: string | undefined
      let calls = 0
      const wrapped = {
        customers: {
          create: async (...args: Parameters<typeof provider.customers.create>) => {
            const customer = await provider.customers.create(...args)
            customers.add(customer.id)
            if (++calls === 1) throw new Error('Synthetic lost response after real sandbox customer creation')
            return customer
          },
        },
        checkout: {
          sessions: {
            retrieve: provider.checkout.sessions.retrieve.bind(provider.checkout.sessions),
            create: async (...args: Parameters<typeof provider.checkout.sessions.create>) => {
              const session = await provider.checkout.sessions.create(...args)
              checkoutId = session.id
              return session
            },
          },
        },
      }
      vi.stubEnv('STRIPE_SK', sandboxKey!)
      vi.stubGlobal('useStripe', () => wrapped)
      vi.stubGlobal('getConfiguredPlanPrice', async () => ({ id: sandboxPrice }))
      const route = (await import('../../server/api/onboarding/checkout.post')).default
      try {
        await expect(route(e as never)).rejects.toMatchObject({ statusCode: 503 })
        const created = await route(e as never)
        expect(new URL(created.url).hostname).toBe('checkout.stripe.com')
        const replayed = await route(e as never)
        // Stripe may refresh the URL fragment while retaining the same Checkout Session.
        expect(new URL(replayed.url).pathname).toBe(new URL(created.url).pathname)
        expect(new URL(replayed.url).hostname).toBe('checkout.stripe.com')
        expect(customers.size).toBe(1)
        expect(calls).toBe(2)
        const session = await provider.checkout.sessions.retrieve(checkoutId!)
        expect(session.livemode).toBe(false)
        expect(session.status).toBe('open')
        expect(session.mode).toBe('subscription')
        expect(await db!.user.count({ where: { email: e.body.email } })).toBe(1)
      } finally {
        if (checkoutId) await provider.checkout.sessions.expire(checkoutId)
        for (const id of customers) await provider.customers.del(id)
      }
    },
    90_000,
  )
})

import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

const SITE = 'site-1'
const updateMany = vi.fn(async () => ({ count: 1 }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
  updateMany.mockClear()
})

describe('syncTranslationLanguageSubscription', () => {
  beforeEach(() => vi.stubGlobal('prisma', { clientSite: { updateMany } }))

  const subscription = (status: string, quantity = 3) =>
    ({
      id: 'sub_lang',
      status,
      metadata: { kind: 'TRANSLATION_LANGUAGES', clientSiteId: SITE },
      items: { data: [{ quantity }] },
    }) as never

  it('mirrors the paid quantity onto the site', async () => {
    const { syncTranslationLanguageSubscription } = await import('../../../server/utils/translationLanguageBilling')
    await syncTranslationLanguageSubscription(subscription('active', 3))
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { languageSubscriptionId: 'sub_lang', extraTranslationLanguages: 3 } }),
    )
  })

  it('leaves no paid languages behind a dead subscription', async () => {
    const { syncTranslationLanguageSubscription } = await import('../../../server/utils/translationLanguageBilling')
    await syncTranslationLanguageSubscription(subscription('unpaid', 3))
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { languageSubscriptionId: null, extraTranslationLanguages: 0 } }),
    )
  })

  it('never takes over a site attached to a different add-on subscription', async () => {
    const { syncTranslationLanguageSubscription } = await import('../../../server/utils/translationLanguageBilling')
    await syncTranslationLanguageSubscription(subscription('active'))
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ languageSubscriptionId: null }, { languageSubscriptionId: 'sub_lang' }],
        }),
      }),
    )
  })
})

describe('POST /api/stripe/translation-languages', () => {
  const stripe = {
    subscriptions: {
      retrieve: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
    },
    checkout: { sessions: { create: vi.fn(async () => ({ url: 'https://checkout.example/lang' })) } },
  }
  const sync = vi.fn()

  const run = async (site: Record<string, unknown>, quantity: number) => {
    vi.stubEnv('STRIPE_PRICE_TRANSLATION_LANGUAGE', 'price_lang')
    await stubNitroImports(import('../../../shared/utils/translationLanguages'), 'MAX_TRANSLATION_LANGUAGES')
    await stubNitroImports(import('../../../server/utils/translationLanguageBilling'), 'TRANSLATION_LANGUAGES_KIND')
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('requireUser', async () => ({ id: 'u1', role: 'admin', clientSiteId: SITE, language: 'en' }))
    vi.stubGlobal('requireTenantScope', vi.fn())
    vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (input: unknown) => unknown) =>
      parse({ quantity, origin: 'https://blog.example' }),
    )
    vi.stubGlobal('prisma', {
      clientSite: {
        findUnique: async () => ({
          plan: 'PRO',
          billingProvider: 'STRIPE',
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: 'sub_plan',
          languageSubscriptionId: null,
          deletedAt: null,
          ...site,
        }),
      },
    })
    vi.stubGlobal('rejectShopifyBilled', (_event: unknown, provider: string) => {
      if (provider === 'SHOPIFY') throw createError({ statusCode: 409 })
    })
    vi.stubGlobal('useStripe', () => stripe)
    vi.stubGlobal('syncTranslationLanguageSubscription', sync)
    vi.stubGlobal('billingReturnUrl', async () => 'https://blog.example/en/settings?tab=ai')
    vi.stubGlobal('logAction', vi.fn())
    vi.stubGlobal('getIp', () => '192.0.2.1')
    const { default: route } = await import('../../../server/api/stripe/translation-languages.post')
    return route({} as never)
  }

  beforeEach(() => {
    for (const fn of [stripe.subscriptions.retrieve, stripe.subscriptions.update, stripe.subscriptions.cancel, sync])
      fn.mockReset()
    stripe.checkout.sessions.create.mockClear()
  })

  it('opens Checkout for the first purchase as a separate, tagged subscription', async () => {
    await expect(run({}, 2)).resolves.toEqual({ url: 'https://checkout.example/lang' })
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        line_items: [{ price: 'price_lang', quantity: 2 }],
        subscription_data: { metadata: { kind: 'TRANSLATION_LANGUAGES', clientSiteId: SITE } },
      }),
      expect.anything(),
    )
  })

  it('changes the quantity of an existing add-on in place', async () => {
    stripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_lang',
      status: 'active',
      items: { data: [{ id: 'si_1', quantity: 1 }] },
    })
    stripe.subscriptions.update.mockResolvedValue({ id: 'sub_lang' })
    await expect(run({ languageSubscriptionId: 'sub_lang' }, 3)).resolves.toEqual({ extraTranslationLanguages: 3 })
    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_lang', {
      items: [{ id: 'si_1', quantity: 3 }],
      proration_behavior: 'create_prorations',
    })
    expect(sync).toHaveBeenCalled()
  })

  it('cancels the add-on when the quantity drops to zero', async () => {
    stripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_lang',
      status: 'active',
      items: { data: [{ id: 'si_1', quantity: 2 }] },
    })
    stripe.subscriptions.cancel.mockResolvedValue({ id: 'sub_lang', status: 'canceled' })
    await run({ languageSubscriptionId: 'sub_lang' }, 0)
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_lang', { prorate: true })
  })

  it.each([
    ['FREE', { plan: 'BASIC' }],
    ['CUSTOM, billed by an operator', { plan: 'CUSTOM' }],
  ])('refuses %s', async (_label, site) => {
    await expect(run(site, 1)).rejects.toMatchObject({ statusCode: 403 })
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('sells to a trial without a plan subscription; the trial end cancels the add-on', async () => {
    await expect(run({ plan: 'PREMIUM', stripeCustomerId: null }, 1)).resolves.toEqual({
      url: 'https://checkout.example/lang',
    })
  })

  it('refuses a Shopify-billed site', async () => {
    await expect(run({ billingProvider: 'SHOPIFY' }, 1)).rejects.toMatchObject({ statusCode: 409 })
  })
})

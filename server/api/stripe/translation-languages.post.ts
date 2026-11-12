import { z } from 'zod'

const BodySchema = z.object({
  quantity: z.number().int().min(0).max(MAX_TRANSLATION_LANGUAGES),
  origin: z.string(),
  locale: z.string().optional(),
})

/**
 * Sets how many translation languages a PRO/PREMIUM site buys beyond its plan. The first purchase goes
 * through Checkout (payment confirmation); later changes update the separate add-on subscription.
 */
export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await requireUser(event, { clientSite: true })
  if (user.role !== 'superadmin') await requireTenantScope(event, 'BILLING_CHANGE', user.clientSiteId)
  await assertBlogNotClosing(user.clientSiteId, t('common.accountDeletion.blogClosing')!)
  const { quantity, origin, locale } = await readValidatedBody(event, BodySchema.parse)

  const site = await prisma.clientSite.findUnique({
    where: { id: user.clientSiteId },
    select: {
      plan: true,
      paidTeamSeats: true,
      billingProvider: true,
      stripeCustomerId: true,
      languageSubscriptionId: true,
      billingAccountId: true,
      deletedAt: true,
    },
  })
  if (!site || site.deletedAt) throw createError({ statusCode: 404, message: t('common.errors.clientNotFound')! })
  rejectShopifyBilled(event, site.billingProvider)
  rejectAgencyBilled(site)
  // CUSTOM is invoiced à la carte by an operator; FREE has no AI to translate with. A trial may buy too:
  // every way back to FREE cancels the add-on (`cancelTranslationLanguageSubscription`).
  if (site.plan !== 'PRO' && site.plan !== 'PREMIUM' && !(site.plan === 'CUSTOM' && site.paidTeamSeats != null))
    throw createError({ statusCode: 403, message: t('common.translationLanguages.planRequired')! })

  const price = process.env.STRIPE_PRICE_TRANSLATION_LANGUAGE
  if (!price) throw createError({ statusCode: 503, message: 'Missing Stripe price for translation languages' })
  const stripe = useStripe()

  if (site.languageSubscriptionId) {
    const current = await stripe.subscriptions.retrieve(site.languageSubscriptionId)
    const item = current.items.data[0]
    if (!['canceled', 'incomplete_expired'].includes(current.status) && item) {
      const updated =
        quantity === 0
          ? await stripe.subscriptions.cancel(current.id, { prorate: true })
          : await stripe.subscriptions.update(current.id, {
              items: [{ id: item.id, quantity }],
              proration_behavior: 'create_prorations',
            })
      await syncTranslationLanguageSubscription(updated)
      await logAction({
        action: 'TRANSLATION_LANGUAGES_CHANGED',
        userId: user.id,
        clientSiteId: user.clientSiteId,
        ip: getIp(event),
        metadata: { from: item.quantity ?? 0, to: quantity },
      })
      return { extraTranslationLanguages: quantity }
    }
  }

  if (quantity === 0) return { extraTranslationLanguages: 0 }

  const returnUrl = await billingReturnUrl(event, origin, locale, user.language, 'ai')
  const metadata = { kind: TRANSLATION_LANGUAGES_KIND, clientSiteId: user.clientSiteId }
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'subscription',
      line_items: [{ price, quantity }],
      success_url: returnUrl,
      cancel_url: returnUrl,
      client_reference_id: user.clientSiteId,
      customer: site.stripeCustomerId ?? undefined,
      metadata,
      subscription_data: { metadata },
    },
    { idempotencyKey: `translation-languages:${user.clientSiteId}:${quantity}:${Math.floor(Date.now() / 1_800_000)}` },
  )
  return { url: session.url }
})

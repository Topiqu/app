import type Stripe from 'stripe'

/** Marks the add-on subscription; plan handlers must never treat its events as plan changes. */
export const TRANSLATION_LANGUAGES_KIND = 'TRANSLATION_LANGUAGES'

export const isTranslationLanguageSubscription = (metadata: Stripe.Metadata | null | undefined) =>
  metadata?.kind === TRANSLATION_LANGUAGES_KIND

const PAYING_STATUSES: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due']

/** Mirrors the add-on subscription onto the site. A dead subscription leaves no paid languages behind. */
export const syncTranslationLanguageSubscription = async (subscription: Stripe.Subscription) => {
  const clientSiteId = subscription.metadata?.clientSiteId
  if (!clientSiteId) return
  const live = PAYING_STATUSES.includes(subscription.status)
  const quantity = live ? Math.max(0, subscription.items.data[0]?.quantity ?? 0) : 0

  // A first purchase without a plan subscription creates the Stripe customer; later checkouts must reuse it.
  const customer = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id
  if (customer)
    await prisma.clientSite.updateMany({
      where: { id: clientSiteId, stripeCustomerId: null },
      data: { stripeCustomerId: customer },
    })
  await prisma.clientSite.updateMany({
    where: {
      id: clientSiteId,
      deletedAt: null,
      billingProvider: 'STRIPE',
      OR: [{ languageSubscriptionId: null }, { languageSubscriptionId: subscription.id }],
    },
    data: live
      ? { languageSubscriptionId: subscription.id, extraTranslationLanguages: quantity }
      : { languageSubscriptionId: null, extraTranslationLanguages: 0 },
  })
}

/** Losing the plan ends the add-on too: paid languages on FREE would be billed for nothing. */
export const cancelTranslationLanguageSubscription = async (clientSiteId: string) => {
  const site = await prisma.clientSite.findUnique({
    where: { id: clientSiteId },
    select: { plan: true, languageSubscriptionId: true },
  })
  if (!site?.languageSubscriptionId || site.plan !== 'BASIC') return
  try {
    await useStripe().subscriptions.cancel(site.languageSubscriptionId, { prorate: true })
  } catch (error) {
    // Already gone in Stripe; the local mirror below is what matters.
    await reportCaughtError('Translation language add-on cancellation failed', error, { clientSiteId })
  }
  await prisma.clientSite.updateMany({
    where: { id: clientSiteId, languageSubscriptionId: site.languageSubscriptionId },
    data: { languageSubscriptionId: null, extraTranslationLanguages: 0 },
  })
}

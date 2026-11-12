import { z } from 'zod'
import { AI_USAGE_PACKS } from '~~/shared/utils/billingCatalog'

export default defineEventHandler(async (event) => {
  const { user, membership } = await requireTenantScope(event, 'BILLING_CHANGE')
  const { packId, origin, locale } = await readValidatedBody(
    event,
    z.object({
      packId: z.enum(['small', 'medium', 'large']),
      origin: z.string(),
      locale: z.string().optional(),
    }).parse,
  )
  const site = await prisma.clientSite.findUniqueOrThrow({
    where: { id: membership.clientSiteId },
    select: { plan: true, billingProvider: true, stripeCustomerId: true, billingAccountId: true },
  })
  rejectShopifyBilled(event, site.billingProvider)
  rejectAgencyBilled(site)
  if (!hasAiPlan(site.plan)) throw createError({ statusCode: 403, message: 'AI plan required' })
  const pack = AI_USAGE_PACKS[packId]
  const { translate } = await useServerI18n(event)
  const returnUrl = await billingReturnUrl(event, origin, locale, user.language)
  const session = await useStripe().checkout.sessions.create({
    mode: 'payment',
    customer: site.stripeCustomerId ?? undefined,
    success_url: returnUrl,
    cancel_url: returnUrl,
    client_reference_id: membership.clientSiteId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: pack.priceCents,
          product_data: { name: `Topiqu · ${translate('common.aiAllowance.packs')} (${pack.TRANSLATION})` },
        },
      },
    ],
    metadata: { kind: 'AI_USAGE_PACK', packId, clientSiteId: membership.clientSiteId },
  })
  return { url: session.url }
})

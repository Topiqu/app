import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { user, member } = await requireAgencyMember(event, { owner: true })
  const { origin, locale } = await readValidatedBody(
    event,
    z.object({ origin: z.string(), locale: z.string().optional() }).parse,
  )
  const account = await prisma.billingAccount.findUniqueOrThrow({
    where: { id: member.accountId },
    select: { stripeCustomerId: true },
  })
  if (!account.stripeCustomerId)
    throw createError({ statusCode: 409, message: 'No agency subscription', data: { code: 'NOT_SUBSCRIBED' } })
  const session = await useStripe().billingPortal.sessions.create({
    customer: account.stripeCustomerId,
    return_url: await billingReturnUrl(event, origin, locale, user.language, 'agency'),
    // Quantities change in the app, where the slot and minimum rules hold; the portal is for invoices and cards.
    ...(process.env.STRIPE_PORTAL_AGENCY_CONFIGURATION
      ? { configuration: process.env.STRIPE_PORTAL_AGENCY_CONFIGURATION }
      : {}),
  })
  return { url: session.url }
})

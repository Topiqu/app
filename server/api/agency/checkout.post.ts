import { z } from 'zod'
import { agencySlotShortfall, isAgencyQuantities } from '~~/shared/utils/agencyPlan'

const schema = z.object({
  blogs: z.number().int(),
  premium: z.number().int(),
  blocks: z.number().int(),
  origin: z.string(),
  locale: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const { user, member } = await requireAgencyMember(event, { owner: true })
  if (!(await consumeRateLimit(`agency-billing:${member.accountId}`, 10, 60)))
    throw createError({ statusCode: 429, message: 'Too many billing changes', data: { code: 'RATE_LIMITED' } })
  const { blogs, premium, blocks, origin, locale } = await readValidatedBody(event, schema.parse)
  if (!isAgencyQuantities({ blogs, premium, blocks }))
    throw createError({ statusCode: 400, message: 'Invalid quantities', data: { code: 'INVALID_QUANTITIES' } })
  const accountId = member.accountId
  const returnUrl = await billingReturnUrl(event, origin, locale, user.language, 'agency')

  return withAgencyLease(accountId, async (leaseId) => {
    const account = await prisma.billingAccount.findUniqueOrThrow({
      where: { id: accountId },
      select: { stripeCustomerId: true, stripeSubscriptionId: true, billingCheckoutId: true },
    })
    const stripe = useStripe()
    if (account.stripeSubscriptionId) {
      const existing = await stripe.subscriptions.retrieve(account.stripeSubscriptionId)
      if (!['canceled', 'incomplete_expired'].includes(existing.status))
        throw createError({ statusCode: 409, message: 'Already subscribed', data: { code: 'ALREADY_SUBSCRIBED' } })
    }
    if (agencySlotShortfall({ blogSlots: blogs, premiumSlots: premium }, await agencyBlogPlans(prisma, accountId)))
      throw createError({ statusCode: 409, message: 'Fewer slots than blogs', data: { code: 'SLOTS_BELOW_BLOGS' } })
    const prices = await getConfiguredAgencyPrices()
    if (!prices) throw createError({ statusCode: 503, message: 'Agency billing is not available' })
    if (account.billingCheckoutId) {
      const previous = await stripe.checkout.sessions.retrieve(account.billingCheckoutId)
      if (previous.status === 'complete') {
        const previousId = typeof previous.subscription === 'string' ? previous.subscription : previous.subscription?.id
        const subscription = previousId ? await stripe.subscriptions.retrieve(previousId) : null
        if (!subscription || !['canceled', 'incomplete_expired'].includes(subscription.status))
          throw createError({ statusCode: 409, message: 'A completed checkout is still being synchronized' })
      }
      if (previous.status === 'open') {
        await renewAgencyLease(accountId, leaseId)
        await stripe.checkout.sessions.expire(previous.id, {}, { timeout: 30_000, maxNetworkRetries: 0 })
      }
    }
    await renewAgencyLease(accountId, leaseId)
    const metadata = { kind: 'AGENCY', billingAccountId: accountId }
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        line_items: [
          { price: prices.blog.id, quantity: blogs },
          ...(premium ? [{ price: prices.premium.id, quantity: premium }] : []),
          { price: prices.units.id, quantity: blocks },
        ],
        success_url: returnUrl,
        cancel_url: returnUrl,
        customer: account.stripeCustomerId ?? undefined,
        customer_email: account.stripeCustomerId ? undefined : user.email,
        metadata,
        subscription_data: { metadata },
      },
      {
        idempotencyKey: `agency:${accountId}:${blogs}:${premium}:${blocks}:${account.billingCheckoutId ?? 'first'}`,
        timeout: 30_000,
        maxNetworkRetries: 0,
      },
    )
    await serializableTransaction(async (tx) => {
      await assertAgencyLease(tx, accountId, leaseId)
      await tx.billingAccount.update({ where: { id: accountId }, data: { billingCheckoutId: session.id } })
    })
    return { url: session.url }
  })
})

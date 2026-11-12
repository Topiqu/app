import type Stripe from 'stripe'

import { z } from 'zod'
import { agencySlotShortfall, isAgencyLive, isAgencyQuantities } from '~~/shared/utils/agencyPlan'

const schema = z.object({ blogs: z.number().int(), premium: z.number().int(), blocks: z.number().int() })

/** Increases are charged at once and apply only when paid; decreases take effect without a credit. */
export default defineEventHandler(async (event) => {
  const { member } = await requireAgencyMember(event, { owner: true })
  if (!(await consumeRateLimit(`agency-billing:${member.accountId}`, 10, 60)))
    throw createError({ statusCode: 429, message: 'Too many billing changes', data: { code: 'RATE_LIMITED' } })
  const target = await readValidatedBody(event, schema.parse)
  if (!isAgencyQuantities(target))
    throw createError({ statusCode: 400, message: 'Invalid quantities', data: { code: 'INVALID_QUANTITIES' } })
  const accountId = member.accountId

  return withAgencyLease(accountId, async (leaseId) => {
    const account = await prisma.billingAccount.findUniqueOrThrow({
      where: { id: accountId },
      select: { status: true, stripeSubscriptionId: true, closingAt: true },
    })
    assertAgencyNotClosing(account)
    if (!isAgencyLive(account.status) || !account.stripeSubscriptionId)
      throw createError({ statusCode: 409, message: 'No active agency subscription', data: { code: 'NOT_SUBSCRIBED' } })
    const plans = await agencyBlogPlans(prisma, accountId)
    if (agencySlotShortfall({ blogSlots: target.blogs, premiumSlots: target.premium }, plans))
      throw createError({ statusCode: 409, message: 'Fewer slots than blogs', data: { code: 'SLOTS_BELOW_BLOGS' } })
    const stripe = useStripe()
    const subscription = await stripe.subscriptions.retrieve(account.stripeSubscriptionId)
    if (subscription.metadata?.billingAccountId !== accountId || subscription.pending_update)
      throw createError({
        statusCode: 409,
        message: 'A change is still waiting for payment',
        data: { code: 'PENDING_PAYMENT' },
      })
    const item = (price: string | undefined) => subscription.items.data.find((row) => row.price.id === price)
    const blog = item(process.env.STRIPE_PRICE_AGENCY_BLOG)
    const units = item(process.env.STRIPE_PRICE_AGENCY_UNITS)
    // Absent until the first add-on: Checkout leaves out a zero quantity.
    const premium = item(process.env.STRIPE_PRICE_AGENCY_PREMIUM)
    if (!blog || !units) throw createError({ statusCode: 409, message: 'Unexpected agency subscription' })
    let premiumPrice = premium?.price.id
    if (!premium && target.premium) {
      const prices = await getConfiguredAgencyPrices()
      if (!prices) throw createError({ statusCode: 503, message: 'Agency billing is not available' })
      premiumPrice = prices.premium.id
    }

    const changes = [
      { id: blog.id, price: blog.price.id, from: blog.quantity ?? 0, to: target.blogs },
      { id: premium?.id, price: premiumPrice, from: premium?.quantity ?? 0, to: target.premium },
      { id: units.id, price: units.price.id, from: units.quantity ?? 0, to: target.blocks },
    ]
    const increases = changes.filter((change) => change.to > change.from)
    const decreases = changes.filter((change) => change.to < change.from)
    const key = `${accountId}:${target.blogs}:${target.premium}:${target.blocks}`
    let current: Stripe.Subscription = subscription
    let invoiceUrl: string | null = null
    if (increases.length) {
      await renewAgencyLease(accountId, leaseId)
      current = await stripe.subscriptions.update(
        subscription.id,
        {
          items: increases.map(({ id, price, to }) => (id ? { id, quantity: to } : { price, quantity: to })),
          proration_behavior: 'always_invoice',
          payment_behavior: 'pending_if_incomplete',
          expand: ['latest_invoice'],
        },
        { idempotencyKey: `agency-up:${key}:${subscription.items.data.map((row) => row.quantity).join('-')}` },
      )
      if (current.pending_update) {
        const invoice = current.latest_invoice
        invoiceUrl = typeof invoice === 'object' && invoice ? (invoice.hosted_invoice_url ?? null) : null
      }
    }
    if (decreases.length && !current.pending_update) {
      await renewAgencyLease(accountId, leaseId)
      current = await stripe.subscriptions.update(
        subscription.id,
        {
          items: decreases.map(({ id, to }) => (to ? { id, quantity: to } : { id, deleted: true })),
          proration_behavior: 'none',
        },
        { idempotencyKey: `agency-down:${key}:${current.items.data.map((row) => row.quantity).join('-')}` },
      )
    }
    await reconcileAgencySubscription(accountId, current, leaseId)
    return { pending: Boolean(current.pending_update), invoiceUrl }
  })
})

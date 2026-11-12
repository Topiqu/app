import type Stripe from 'stripe'
import type { H3Event } from 'h3'
import type { AgencyStatus, TenantScope } from '~~/generated/zenstack/models'

import { randomUUID } from 'node:crypto'
import { agencySlotShortfall, agencyUnits, isAgencyLive } from '~~/shared/utils/agencyPlan'

const LEASE_MS = 5 * 60_000
/** Covers the sibling events of one Checkout; a plan change that holds the lease longer still gets Stripe's retry. */
const WEBHOOK_LEASE_WAIT_MS = 5_000
const pending = () =>
  createError({ statusCode: 409, message: 'Billing change in progress', data: { code: 'BILLING_CHANGE_PENDING' } })

/**
 * The signed-in person's agency, resolved through the policy client, which reads an agency only to its members.
 * Only OWNER changes billing, blogs and people. Ledger, projection and Stripe writes stay on the system client.
 */
export const requireAgencyMember = async (event: H3Event, { owner = false } = {}) => {
  const user = await requireUser(event)
  if (user.role === 'ai') throw createError({ statusCode: 403, message: 'Forbidden' })
  const db = await getEnhancedPrisma(user)
  const member = await db.billingAccountMember.findFirst({
    where: { userId: user.id, deletedAt: null, account: { kind: 'AGENCY' } },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, role: true, scopes: true, accountId: true },
  })
  if (!member) throw createError({ statusCode: 404, message: 'No agency', data: { code: 'NO_AGENCY' } })
  if (owner && member.role !== 'OWNER') throw createError({ statusCode: 403, message: 'Agency owner required' })
  return { user, member, db }
}

type PolicyClient = Awaited<ReturnType<typeof getEnhancedPrisma>>

/** A blog id from the request, proven to be one of this agency's blogs by the policy client. */
export const requireAgencyBlog = async (db: PolicyClient, accountId: string, clientSiteId: string) => {
  const account = await db.billingAccount.findFirst({
    where: { id: accountId },
    select: { agencySites: { where: { id: clientSiteId }, select: { id: true } } },
  })
  if (!account?.agencySites.length) throw createError({ statusCode: 404, message: 'Blog not found' })
}

/**
 * Serializes provider reads with the local writes they justify, like the blog billing lease. `waitMs` lets a webhook
 * queue behind its sibling events (Checkout sends three at once) instead of waiting for Stripe's retry.
 */
export const withAgencyLease = async <T>(
  accountId: string,
  run: (leaseId: string) => Promise<T>,
  { waitMs = 0 } = {},
): Promise<T> => {
  const id = randomUUID()
  const deadline = Date.now() + waitMs
  const claim = () =>
    prisma.billingAccount.updateMany({
      where: {
        id: accountId,
        kind: 'AGENCY',
        OR: [{ billingLeaseUntil: null }, { billingLeaseUntil: { lte: new Date() } }],
      },
      data: { billingLeaseId: id, billingLeaseUntil: new Date(Date.now() + LEASE_MS) },
    })
  while (!(await claim()).count) {
    if (Date.now() >= deadline) throw pending()
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  try {
    return await run(id)
  } finally {
    await prisma.billingAccount
      .updateMany({
        where: { id: accountId, billingLeaseId: id },
        data: { billingLeaseId: null, billingLeaseUntil: null },
      })
      .catch((error) => reportCaughtError('Agency lease release failed', error, { accountId }))
  }
}

export const assertAgencyLease = async (tx: DatabaseTransaction, accountId: string, leaseId: string) => {
  const current = await tx.billingAccount.updateMany({
    where: { id: accountId, billingLeaseId: leaseId, billingLeaseUntil: { gt: new Date() } },
    data: { updatedAt: new Date() },
  })
  if (!current.count) throw pending()
}

export const renewAgencyLease = (accountId: string, leaseId: string) =>
  prisma.billingAccount.updateMany({
    where: { id: accountId, billingLeaseId: leaseId, billingLeaseUntil: { gt: new Date() } },
    data: { billingLeaseUntil: new Date(Date.now() + LEASE_MS) },
  })

export const agencyStatusOf = (status: Stripe.Subscription.Status): AgencyStatus =>
  status === 'active' || status === 'trialing'
    ? 'ACTIVE'
    : status === 'past_due'
      ? 'PAST_DUE'
      : status === 'incomplete'
        ? 'INACTIVE'
        : 'CANCELED'

export const agencyQuantitiesOf = (subscription: Stripe.Subscription) => {
  const quantity = (price: string | undefined) =>
    subscription.items.data.find((item) => item.price.id === price)?.quantity ?? 0
  return {
    blogs: quantity(process.env.STRIPE_PRICE_AGENCY_BLOG),
    premium: quantity(process.env.STRIPE_PRICE_AGENCY_PREMIUM),
    blocks: quantity(process.env.STRIPE_PRICE_AGENCY_UNITS),
  }
}

/** The plans that take the agency's slots; a deleted blog frees its slot. */
export const agencyBlogPlans = async (
  db: Pick<DatabaseTransaction, 'clientSite'> | Pick<DatabaseClient, 'clientSite'>,
  accountId: string,
  exceptId?: string,
) => {
  const rows = await db.clientSite.findMany({
    where: { billingAccountId: accountId, deletedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { agencyPlan: true },
  })
  return rows.map((row) => row.agencyPlan)
}

/**
 * Agency blogs cache the plan their account pays for: their pick while live, BASIC otherwise. A pick the paid slots
 * no longer cover (a quantity lowered in Stripe itself, or a race with a decrease) steps down, newest blogs first.
 */
export const syncAgencySites = async (accountId: string) => {
  const sites = await prisma.clientSite.findMany({
    where: { billingAccountId: accountId, deletedAt: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  })
  for (const [index, { id }] of sites.entries())
    await serializableTransaction(async (tx) => {
      const site = await lockBlog(tx, id)
      if (site.billingAccountId !== accountId || site.deletedAt) return
      const account = await lockBillingAccount(tx, accountId)
      const ahead = await tx.clientSite.findMany({
        where: { billingAccountId: accountId, deletedAt: null, id: { in: sites.slice(0, index).map((row) => row.id) } },
        select: { agencyPlan: true },
      })
      const plans = ahead.map((row) => row.agencyPlan)
      let agencyPlan = site.agencyPlan ?? 'BASIC'
      if (agencyPlan === 'PREMIUM' && agencySlotShortfall(account, [...plans, 'PREMIUM'])) agencyPlan = 'PRO'
      if (agencyPlan === 'PRO' && agencySlotShortfall(account, [...plans, 'PRO'])) agencyPlan = 'BASIC'
      const plan = isAgencyLive(account.status) ? agencyPlan : 'BASIC'
      if (agencyPlan === site.agencyPlan && plan === site.plan) return
      await tx.clientSite.update({ where: { id }, data: { agencyPlan, plan } })
      if (plan !== site.plan) await syncPlanFeatures(tx, id)
    })
}

/** Mirrors agency members onto every agency blog. A row the blog team created itself is never touched. */
export const syncAgencyMemberships = (accountId: string) =>
  serializableTransaction(async (tx) => {
    const [members, sites] = await Promise.all([
      tx.billingAccountMember.findMany({
        where: { accountId, deletedAt: null, user: { deletedAt: null } },
        select: { userId: true, role: true, scopes: true },
      }),
      tx.clientSite.findMany({ where: { billingAccountId: accountId, deletedAt: null }, select: { id: true } }),
    ])
    const siteIds = sites.map(({ id }) => id)
    await tx.tenantMembership.deleteMany({
      where: {
        billingAccountId: accountId,
        OR: [{ clientSiteId: { notIn: siteIds } }, { userId: { notIn: members.map(({ userId }) => userId) } }],
      },
    })
    const existing = await tx.tenantMembership.findMany({
      where: { clientSiteId: { in: siteIds }, userId: { in: members.map(({ userId }) => userId) } },
      select: {
        id: true,
        clientSiteId: true,
        userId: true,
        role: true,
        scopes: true,
        billingAccountId: true,
        deletedAt: true,
      },
    })
    for (const member of members) {
      // A blog has exactly one OWNER — its own; agency owners get every scope instead.
      const role = 'MEMBER' as const
      const scopes: TenantScope[] = member.role === 'OWNER' ? [...TENANT_SCOPES] : member.scopes
      for (const clientSiteId of siteIds) {
        const row = existing.find((item) => item.clientSiteId === clientSiteId && item.userId === member.userId)
        if (!row) {
          await tx.tenantMembership.create({
            data: { clientSiteId, userId: member.userId, role, scopes, billingAccountId: accountId },
          })
          continue
        }
        // A live manual membership stays the blog team's; a removed one is taken over by the agency.
        if (row.billingAccountId !== accountId && row.deletedAt === null) continue
        if (
          row.billingAccountId === accountId &&
          row.deletedAt === null &&
          row.role === role &&
          row.scopes.length === scopes.length &&
          scopes.every((scope) => row.scopes.includes(scope))
        )
          continue
        await tx.tenantMembership.update({
          where: { id: row.id },
          data: { role, scopes, billingAccountId: accountId, deletedAt: null },
        })
      }
    }
  })

/** Drops a person's agency access at once; sessions parked on those blogs fall back to no tenant. */
export const revokeAgencyAccess = async (
  tx: DatabaseTransaction,
  accountId: string,
  where: { userId?: string; clientSiteId?: string },
) => {
  const rows = await tx.tenantMembership.findMany({
    where: { billingAccountId: accountId, ...where },
    select: { userId: true, clientSiteId: true },
  })
  await tx.tenantMembership.deleteMany({ where: { billingAccountId: accountId, ...where } })
  for (const row of rows) {
    await tx.session.updateMany({
      where: { userId: row.userId, clientSiteId: row.clientSiteId },
      data: { clientSiteId: null },
    })
    await tx.user.updateMany({
      where: { id: row.userId, clientSiteId: row.clientSiteId },
      data: { clientSiteId: null },
    })
  }
}

/** Writes the provider's current state; the caller holds the agency lease. */
export const reconcileAgencySubscription = async (
  accountId: string,
  subscription: Stripe.Subscription,
  leaseId: string,
) => {
  if (subscription.metadata?.billingAccountId !== accountId) return false
  const { blogs, premium, blocks } = agencyQuantitiesOf(subscription)
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
  // `unpaid` still revives when its invoice is paid, so only terminal states release the subscription.
  const ended = subscription.status === 'canceled' || subscription.status === 'incomplete_expired'
  const changed = await serializableTransaction(async (tx) => {
    await assertAgencyLease(tx, accountId, leaseId)
    return tx.billingAccount.updateMany({
      where: {
        id: accountId,
        kind: 'AGENCY',
        OR: [{ stripeSubscriptionId: null }, { stripeSubscriptionId: subscription.id }],
      },
      data: {
        status: agencyStatusOf(subscription.status),
        blogSlots: blogs,
        premiumSlots: premium,
        unitBlocks: blocks,
        stripeCustomerId: customerId,
        stripeSubscriptionId: ended ? null : subscription.id,
      },
    })
  })
  await syncAgencySites(accountId)
  return changed.count > 0
}

const linePrice = (line: Stripe.InvoiceLineItem) => {
  const price = line.pricing?.price_details?.price
  return typeof price === 'string' ? price : price?.id
}

/** A paid agency invoice grants the period's units and its AI budget; replays change nothing. */
export const creditAgencyInvoice = async (
  stripe: Stripe,
  accountId: string,
  invoice: Stripe.Invoice,
  subscription: Stripe.Subscription,
  leaseId: string,
) => {
  if (subscription.status !== 'active' || !invoice.id) return
  const lines = invoice.lines.data.filter((line) => isAgencyPriceId(linePrice(line)))
  if (!lines.length) return
  const charged = lines.find((line) => line.amount > 0) ?? lines[0]!
  let periodStart = new Date(charged.period.start * 1000)
  let periodEnd = new Date(charged.period.end * 1000)
  const servicePeriodEnd = periodEnd
  // The units paid for, not the subscription read afterwards, decide what this invoice grants.
  const unitLines = lines.filter(
    (line) => linePrice(line) === process.env.STRIPE_PRICE_AGENCY_UNITS && line.amount > 0 && line.quantity,
  )
  const blocks = unitLines.length
    ? Math.max(...unitLines.map((line) => line.quantity!))
    : agencyQuantitiesOf(subscription).blocks
  const update = invoice.billing_reason === 'subscription_update'
  const recurringBaseCents = update
    ? agencyInvoiceNetCents(
        await stripe.invoices.createPreview({ subscription: subscription.id, preview_mode: 'recurring' }),
      )
    : undefined
  const now = new Date()
  await serializableTransaction(async (tx) => {
    await assertAgencyLease(tx, accountId, leaseId)
    await lockBillingAccount(tx, accountId)
    if (update) {
      const slot = await tx.articleCreditGrant.findFirst({
        where: { accountId, source: 'PLAN', periodStart: { lte: now }, expiresAt: { gt: now } },
        orderBy: { periodStart: 'asc' },
        select: { periodStart: true, periodEnd: true },
      })
      if (slot?.periodStart && slot.periodEnd) {
        periodStart = slot.periodStart
        periodEnd = slot.periodEnd
      }
    }
    await tx.billingAccount.updateMany({ where: { id: accountId, firstPaidAt: null }, data: { firstPaidAt: now } })
    await tx.billingAccount.updateMany({
      where: { id: accountId, OR: [{ paidThrough: null }, { paidThrough: { lt: servicePeriodEnd } }] },
      data: { paidThrough: servicePeriodEnd },
    })
    await grantPlanArticleCredits(tx, {
      accountId,
      amount: agencyUnits(blocks),
      idempotencyKey: `stripe:invoice:${invoice.id}`,
      reason: 'Agency units',
      periodStart,
      periodEnd,
    })
    await creditAgencyInvoiceAiBudget(tx, { accountId, invoice, periodStart, periodEnd, recurringBaseCents })
  })
}

/** Routes an agency subscription event; returns false for every event that is not an agency's. */
export const handleAgencyStripeEvent = async (stripe: Stripe, event: Stripe.Event) => {
  let accountId: string | undefined
  let subscriptionId: string | undefined
  let invoice: Stripe.Invoice | undefined
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object
    if (session.metadata?.kind !== 'AGENCY') return false
    accountId = session.metadata.billingAccountId
    subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
  } else if (
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted' ||
    event.type === 'customer.subscription.paused' ||
    event.type === 'customer.subscription.resumed'
  ) {
    accountId = event.data.object.metadata?.billingAccountId
    if (!accountId) return false
    subscriptionId = event.data.object.id
  } else if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
    invoice = event.data.object
    subscriptionId = extractSubscriptionId(invoice) ?? undefined
    accountId = invoice.parent?.subscription_details?.metadata?.billingAccountId
    if (!accountId) {
      // The invoice snapshot can lack metadata; the subscription itself is authoritative.
      if (!subscriptionId || invoice.parent?.subscription_details?.metadata?.clientSiteId) return false
      accountId = (await stripe.subscriptions.retrieve(subscriptionId)).metadata?.billingAccountId
      if (!accountId) return false
    }
  } else return false
  if (!accountId || !subscriptionId) return true

  await withAgencyLease(
    accountId,
    async (leaseId) => {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      if (subscription.metadata?.billingAccountId !== accountId) return
      await reconcileAgencySubscription(accountId, subscription, leaseId)
      if (invoice) await creditAgencyInvoice(stripe, accountId, invoice, subscription, leaseId)
    },
    { waitMs: WEBHOOK_LEASE_WAIT_MS },
  )
  return true
}

type AgencyPeriod = { start: Date; end: Date | null }

/** The agency's billing periods, newest first; every paid invoice opens or tops up one. */
export const agencyPeriods = async (accountId: string) => {
  const grants = await prisma.articleCreditGrant.findMany({
    where: { accountId, source: 'PLAN', periodStart: { not: null } },
    orderBy: { periodStart: 'desc' },
    select: { periodStart: true, periodEnd: true },
    take: 200,
  })
  const periods = new Map<number, AgencyPeriod>()
  for (const { periodStart, periodEnd } of grants)
    if (periodStart && !periods.has(periodStart.getTime()))
      periods.set(periodStart.getTime(), { start: periodStart, end: periodEnd })
  return [...periods.values()].slice(0, 24)
}

/**
 * What each blog spent from the pool in a period, the current one by default. Usage is read from the pool's own
 * operations, so a blog that has left since still answers for what it spent while attached.
 */
export const agencyBlogUsage = async (accountId: string, chosen?: AgencyPeriod) => {
  const now = new Date()
  const period =
    chosen ??
    (await prisma.articleCreditGrant
      .findFirst({
        where: { accountId, source: 'PLAN', periodStart: { lte: now }, expiresAt: { gt: now } },
        orderBy: { periodStart: 'asc' },
        select: { periodStart: true, periodEnd: true },
      })
      .then((slot) => (slot?.periodStart ? { start: slot.periodStart, end: slot.periodEnd } : null)))
  const since = period?.start ?? new Date(now.getTime() - 30 * 86400000)
  const createdAt = { gte: since, ...(period?.end ? { lt: period.end } : {}) }
  const usage = await prisma.articleCreditOperation.groupBy({
    by: ['clientSiteId'],
    where: { accountId, status: { in: ['RESERVED', 'COMPLETED'] }, createdAt },
    _sum: { reserved: true },
  })
  const blogs = await prisma.clientSite.findMany({
    where: { OR: [{ billingAccountId: accountId }, { id: { in: usage.map((row) => row.clientSiteId) } }] },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      domain: true,
      deletedAt: true,
      monthlyUnitLimit: true,
      agencyPlan: true,
      billingAccountId: true,
    },
  })
  const attached = blogs.filter((blog) => blog.billingAccountId === accountId)
  const published = await prisma.article.groupBy({
    by: ['clientSiteId'],
    where: {
      clientSiteId: { in: attached.map(({ id }) => id) },
      status: 'published',
      publishedAt: createdAt,
    },
    _count: { _all: true },
  })
  // Read without the ledger locks, so a just-expired grant may still count until the blog next spends.
  const own = await prisma.articleCreditWallet.findMany({
    where: { id: { in: attached.map(({ id }) => id) } },
    select: { id: true, balance: true, reserved: true },
  })
  const unitsOf = (id: string) => usage.find((row) => row.clientSiteId === id)?._sum.reserved ?? 0
  return {
    period,
    since,
    usedUnits: usage.reduce((total, row) => total + (row._sum.reserved ?? 0), 0),
    blogs: attached.map((blog) => ({
      id: blog.id,
      name: blog.name,
      domain: blog.domain,
      deleted: blog.deletedAt !== null,
      plan: blog.agencyPlan ?? 'BASIC',
      monthlyUnitLimit: blog.monthlyUnitLimit,
      unitsUsed: unitsOf(blog.id),
      published: published.find((row) => row.clientSiteId === blog.id)?._count._all ?? 0,
      ownUnits: Math.max(
        0,
        own
          .filter((wallet) => wallet.id === blog.id)
          .reduce((total, wallet) => total + wallet.balance - wallet.reserved, 0),
      ),
    })),
    // Left the agency since; their articles after leaving are no longer the agency's, so only units count.
    former: blogs
      .filter((blog) => blog.billingAccountId !== accountId)
      .map((blog) => ({ id: blog.id, name: blog.name, domain: blog.domain, unitsUsed: unitsOf(blog.id) })),
  }
}

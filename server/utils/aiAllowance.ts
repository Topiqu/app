import type Stripe from 'stripe'
import type { AiAllowanceKind } from '~~/shared/utils/billingCatalog'
import type { AiUsageReservation, BillingAccount, ClientSite } from '~~/generated/zenstack/models'

import { randomUUID } from 'node:crypto'
import { hasAiPlan } from '~~/shared/utils/plans'
import { ARTICLE_PACK_LIST } from '~~/shared/utils/articlePacks'
import { nextArticleCreditMonth } from '~~/shared/utils/articleCredits'
import { agencyAllowances, isAgencyLive } from '~~/shared/utils/agencyPlan'
import {
  AI_ALLOWANCES,
  AI_ALLOWANCE_KINDS,
  AI_BUDGET_MICROS_PER_CENT,
  AI_USAGE_PACKS,
  ARTICLE_UNIT_FUNDING_MICROS,
  BILLING_POLICY_VERSION,
  isInternalAiAllowance,
} from '~~/shared/utils/billingCatalog'

type Allocation = { id: string; amount: number }[]
type Terms = { start: Date; end: Date; trial: boolean; ceilings: Record<AiAllowanceKind, number> }
// Funding that only an article operation allocating the matching article grant may spend.
const ARTICLE_FUNDING_SOURCES = ['ARTICLE_PURCHASE', 'ARTICLE_ROLLOVER']
const articleFundingKey = (articleGrantId: string) => `article-funding:${articleGrantId}`
const costDebtField = (kind: string) =>
  kind === 'BUDGET' ? 'aiBudgetDebtMicros' : kind === 'SEO' ? 'seoBudgetDebtMicros' : null
// An agency's provider-cost overruns belong to its pool; a DIRECT account's stay on its blog.
const debtOf = (site: ClientSite, account: BillingAccount, field: 'aiBudgetDebtMicros' | 'seoBudgetDebtMicros') =>
  account.kind === 'AGENCY' ? account[field] : site[field]

const grant = async (
  tx: DatabaseTransaction,
  data: {
    accountId: string
    clientSiteId: string | null
    kind: AiAllowanceKind
    amount: number
    source: string
    idempotencyKey: string
    expiresAt?: Date | null
    periodStart?: Date | null
  },
) => {
  if (data.amount === 0) return
  if (!Number.isSafeInteger(data.amount) || data.amount < 0 || data.amount > 2_000_000_000)
    throw new RangeError('Invalid AI grant')
  const stored = await tx.aiAllowanceGrant.upsert({
    where: { idempotencyKey: data.idempotencyKey },
    update: {},
    create: { ...data, remaining: data.amount, policyVersion: BILLING_POLICY_VERSION },
  })
  if (
    stored.accountId !== data.accountId ||
    stored.kind !== data.kind ||
    stored.amount !== data.amount ||
    stored.source !== data.source
  )
    throw createError({ statusCode: 409, message: 'AI grant key already used' })
}

const directTerms = async (tx: DatabaseTransaction, site: ClientSite, now: Date): Promise<Terms | null> => {
  if (!['PRO', 'PREMIUM', 'CUSTOM'].includes(site.plan)) return null
  const trial = Boolean(
    site.trialStartedAt && !site.firstPaidAt && site.billingPlan !== 'PERMANENT' && site.plan !== 'CUSTOM',
  )
  if (trial && (!site.trialEndsAt || site.trialEndsAt <= now)) return null
  const included = AI_ALLOWANCES[trial ? 'TRIAL' : (site.plan as 'PRO' | 'PREMIUM' | 'CUSTOM')]
  const latest = trial
    ? null
    : await tx.articleCreditGrant.findFirst({
        where: { accountId: site.id, source: 'PLAN', periodStart: { lte: now }, expiresAt: { gt: now } },
        orderBy: { periodStart: 'asc' },
        select: { periodStart: true, periodEnd: true },
      })
  // Only manual/permanent contracts may renew without a paid invoice-backed article grant.
  if (!trial && !latest && site.billingPlan !== 'PERMANENT' && !(site.plan === 'CUSTOM' && site.paidTeamSeats === null))
    return null
  let start = trial ? site.trialStartedAt! : (latest?.periodStart ?? site.createdAt)
  if (!trial && !latest) {
    // Manual/permanent contracts keep the same monthly anniversary as their blog.
    while (nextArticleCreditMonth(start) <= now) start = nextArticleCreditMonth(start)
  }
  const end = trial ? site.trialEndsAt! : (latest?.periodEnd ?? nextArticleCreditMonth(start))
  const budget = trial
    ? included.BUDGET
    : (site.aiBudgetMonthlyMicros ?? Math.round(included.BUDGET * (site.billingPlan === 'ANNUAL' ? 0.8 : 1)))
  return { start, end, trial, ceilings: { ...included, BUDGET: budget } }
}

/** An agency period exists only while its subscription is active and an invoice granted its units. */
const agencyTerms = async (tx: DatabaseTransaction, account: BillingAccount, now: Date): Promise<Terms | null> => {
  if (!isAgencyLive(account.status)) return null
  const latest = await tx.articleCreditGrant.findFirst({
    where: { accountId: account.id, source: 'PLAN', periodStart: { lte: now }, expiresAt: { gt: now } },
    orderBy: { periodStart: 'asc' },
    select: { periodStart: true, periodEnd: true },
  })
  if (!latest?.periodStart || !latest.periodEnd) return null
  const included = agencyAllowances({
    blogs: account.blogSlots,
    premium: account.premiumSlots,
    blocks: account.unitBlocks,
  })
  return {
    start: latest.periodStart,
    end: latest.periodEnd,
    trial: false,
    ceilings: { ...included, BUDGET: account.aiBudgetMonthlyMicros ?? included.BUDGET },
  }
}

/** `account` is the one `site` spends from; a DIRECT account shares the blog's id. */
const fund = async (
  tx: DatabaseTransaction,
  site: ClientSite,
  account: BillingAccount,
  now: Date,
  purchaseIds: string[] = [],
) => {
  // A paused (BASIC) agency blog sits next to a funded pool it must not spend.
  const terms =
    account.kind === 'AGENCY'
      ? hasAiPlan(site.plan)
        ? await agencyTerms(tx, account, now)
        : null
      : await directTerms(tx, site, now)
  if (!terms) return null
  const { start, end, trial } = terms
  const accountId = account.id
  const owner = account.kind === 'AGENCY' ? null : site.id
  for (const kind of AI_ALLOWANCE_KINDS) {
    // An invoice funds this billing cycle explicitly, including discounts and prorations.
    // Annual continuation slots have no invoice and use the stored monthly base allocation.
    if (
      kind === 'BUDGET' &&
      !trial &&
      (await tx.aiAllowanceGrant.count({
        where: { accountId, kind, source: { in: ['PAID_BASE_BUDGET', 'PAID_BUDGET'] }, periodStart: start },
      }))
    )
      continue
    const ceiling = terms.ceilings[kind]
    const existing = await tx.aiAllowanceGrant.aggregate({
      where: { accountId, kind, source: trial ? 'TRIAL' : 'PLAN', periodStart: start },
      _sum: { amount: true },
    })
    await grant(tx, {
      accountId,
      clientSiteId: owner,
      kind,
      amount: Math.max(0, ceiling - (existing._sum.amount ?? 0)),
      source: trial ? 'TRIAL' : 'PLAN',
      periodStart: start,
      expiresAt: end,
      idempotencyKey: `included:${BILLING_POLICY_VERSION}:${accountId}:${start.toISOString()}:${kind}:${ceiling}`,
    })
  }
  await fundArticles(tx, accountId, purchaseIds)
  return { start, end, trial }
}

/** Bought and carried articles retain separately funded capacity; this never consumes their balance. */
const fundArticles = async (tx: DatabaseTransaction, accountId: string, purchaseIds: string[]) => {
  const articles = await tx.articleCreditGrant.findMany({
    where: {
      accountId,
      source: { in: ['PURCHASE', 'ROLLOVER'] },
      OR: [{ remaining: { gt: 0 } }, { id: { in: purchaseIds } }],
    },
    select: { id: true, amount: true, source: true, clientSiteId: true },
  })
  // Funding minted under an earlier rate keeps its amount.
  const funded = await tx.aiAllowanceGrant.findMany({
    where: { idempotencyKey: { in: articles.map((article) => articleFundingKey(article.id)) } },
    select: { idempotencyKey: true },
  })
  for (const article of articles) {
    if (funded.some((row) => row.idempotencyKey === articleFundingKey(article.id))) continue
    const pack = ARTICLE_PACK_LIST.find((candidate) => candidate.articles === article.amount)
    const priceUsd = pack ? pack.priceUsd : article.amount * (22.49 / 25)
    await grant(tx, {
      accountId,
      clientSiteId: article.clientSiteId,
      kind: 'BUDGET',
      amount:
        article.source === 'ROLLOVER'
          ? article.amount * ARTICLE_UNIT_FUNDING_MICROS
          : Math.round(priceUsd * 100 * AI_BUDGET_MICROS_PER_CENT),
      source: article.source === 'ROLLOVER' ? 'ARTICLE_ROLLOVER' : 'ARTICLE_PURCHASE',
      idempotencyKey: articleFundingKey(article.id),
    })
  }
}

const linesNetCents = (invoice: Stripe.Invoice, matches: (priceId: string) => boolean): number | null => {
  if (invoice.currency !== 'usd' || invoice.lines.has_more) return null
  let total = 0
  let known = false
  for (const line of invoice.lines.data) {
    const rawPrice = line.pricing?.price_details?.price
    const id = typeof rawPrice === 'string' ? rawPrice : rawPrice?.id
    if (!id || !matches(id) || !Number.isSafeInteger(line.amount)) continue
    known = true
    total += line.amount - (line.discount_amounts ?? []).reduce((sum, discount) => sum + discount.amount, 0)
  }
  return known ? total : null
}

/** Stripe line amounts exclude tax; recurring discounts are applied separately. */
export const invoiceBaseNetCents = (invoice: Stripe.Invoice, priceId?: string): number | null =>
  linesNetCents(invoice, (id) => (priceId ? id === priceId : !!planFromPriceId(id)))

/** Agency blog and unit lines, net of discounts. */
export const agencyInvoiceNetCents = (invoice: Stripe.Invoice): number | null => linesNetCents(invoice, isAgencyPriceId)

/** Only verified paid plan lines fund AI. Seat revenue, taxes and language add-ons do not. */
export const creditInvoiceAiBudget = async (
  tx: DatabaseTransaction,
  input: {
    clientSiteId: string
    invoice: Stripe.Invoice
    price: Stripe.Price
    periodStart: Date
    periodEnd: Date
    servicePeriodEnd?: Date
    recurringBaseCents?: number | null
  },
) => {
  const { invoice, price, clientSiteId } = input
  // A direct subscription funds the blog's own account.
  const accountId = clientSiteId
  if (!invoice.id || invoice.currency !== 'usd') return
  const previous = await tx.aiAllowanceInvoice.findUnique({ where: { id: invoice.id } })
  if (previous) {
    if (previous.accountId !== accountId) throw new Error('AI invoice tenant mismatch')
    return
  }
  const netCents = invoiceBaseNetCents(invoice)
  if (netCents === null) return
  const fullPeriod = invoice.billing_reason === 'subscription_create' || invoice.billing_reason === 'subscription_cycle'
  const annual = fullPeriod
    ? (input.servicePeriodEnd ?? input.periodEnd).getTime() - input.periodStart.getTime() > 300 * 86400000
    : price.recurring?.interval === 'year'
  const currentCycle = fullPeriod
    ? null
    : await tx.articleCreditGrant.findFirst({
        where: { accountId, source: 'PLAN', periodStart: { lte: new Date() }, expiresAt: { gt: new Date() } },
        orderBy: { periodStart: 'asc' },
        select: { periodStart: true, periodEnd: true },
      })
  const start = currentCycle?.periodStart ?? input.periodStart
  const end = currentCycle?.periodEnd ?? input.periodEnd
  if (!start || !end) return
  const existing = await tx.aiAllowanceGrant.aggregate({
    where: {
      accountId,
      kind: 'BUDGET',
      source: { in: fullPeriod ? ['PLAN', 'PAID_BASE_BUDGET'] : ['PLAN', 'PAID_BASE_BUDGET', 'PAID_BUDGET'] },
      periodStart: start,
    },
    _sum: { amount: true },
  })
  const stored = await tx.clientSite.findUniqueOrThrow({
    where: { id: clientSiteId },
    select: { aiBudgetMonthlyMicros: true },
  })
  const currentBase = fullPeriod ? invoiceBaseNetCents(invoice, price.id) : input.recurringBaseCents
  const monthly = fullPeriod
    ? Math.max(0, Math.floor((netCents * AI_BUDGET_MICROS_PER_CENT) / (annual ? 12 : 1)))
    : currentBase != null
      ? Math.max(0, Math.floor((currentBase * AI_BUDGET_MICROS_PER_CENT) / (annual ? 12 : 1)))
      : (stored.aiBudgetMonthlyMicros ?? 0)
  const amount = fullPeriod
    ? Math.max(0, monthly - (existing._sum.amount ?? 0))
    : Math.min(
        Math.max(0, Math.floor(netCents * AI_BUDGET_MICROS_PER_CENT)),
        Math.max(0, monthly - (existing._sum.amount ?? 0)),
      )
  // A late invoice for an old price may fund its own cycle but cannot restore an old baseline.
  if (currentBase != null)
    await tx.clientSite.updateMany({
      where: {
        id: clientSiteId,
        OR: [{ paidThrough: null }, { paidThrough: { lte: input.servicePeriodEnd ?? input.periodEnd } }],
      },
      data: {
        aiBudgetMonthlyMicros: Math.max(0, Math.floor((currentBase * AI_BUDGET_MICROS_PER_CENT) / (annual ? 12 : 1))),
      },
    })
  await grant(tx, {
    accountId,
    clientSiteId,
    kind: 'BUDGET',
    source: fullPeriod ? 'PAID_BASE_BUDGET' : 'PAID_BUDGET',
    amount,
    periodStart: start,
    expiresAt: end,
    idempotencyKey: `ai-invoice:${invoice.id}`,
  })
  await tx.aiAllowanceInvoice.create({
    data: { id: invoice.id, accountId, clientSiteId, grantedMicros: amount, policyVersion: BILLING_POLICY_VERSION },
  })
  if (amount > 0)
    await tx.articleTranslation.updateMany({
      where: { clientSiteId, error: 'AI_ALLOWANCE_EXHAUSTED', aiRetryAt: { not: null } },
      data: { aiRetryAt: null },
    })
}

/** The agency's AI budget is half of what it paid for blogs and units, like a direct plan. */
export const creditAgencyInvoiceAiBudget = async (
  tx: DatabaseTransaction,
  input: {
    accountId: string
    invoice: Stripe.Invoice
    periodStart: Date
    periodEnd: Date
    /** Next cycle's net for blogs and units, after a quantity change; undefined on a full-period invoice. */
    recurringBaseCents?: number | null
  },
) => {
  const { invoice, accountId } = input
  if (!invoice.id || invoice.currency !== 'usd') return
  const previous = await tx.aiAllowanceInvoice.findUnique({ where: { id: invoice.id } })
  if (previous) {
    if (previous.accountId !== accountId) throw new Error('AI invoice account mismatch')
    return
  }
  const netCents = agencyInvoiceNetCents(invoice)
  if (netCents === null) return
  const fullPeriod = invoice.billing_reason === 'subscription_create' || invoice.billing_reason === 'subscription_cycle'
  const existing = await tx.aiAllowanceGrant.aggregate({
    where: {
      accountId,
      kind: 'BUDGET',
      source: { in: fullPeriod ? ['PLAN', 'PAID_BASE_BUDGET'] : ['PLAN', 'PAID_BASE_BUDGET', 'PAID_BUDGET'] },
      periodStart: input.periodStart,
    },
    _sum: { amount: true },
  })
  const stored = await tx.billingAccount.findUniqueOrThrow({
    where: { id: accountId },
    select: { aiBudgetMonthlyMicros: true },
  })
  const base = fullPeriod ? netCents : input.recurringBaseCents
  const monthly =
    base != null ? Math.max(0, Math.floor(base * AI_BUDGET_MICROS_PER_CENT)) : (stored.aiBudgetMonthlyMicros ?? 0)
  const room = Math.max(0, monthly - (existing._sum.amount ?? 0))
  const amount = fullPeriod ? room : Math.min(Math.max(0, Math.floor(netCents * AI_BUDGET_MICROS_PER_CENT)), room)
  // A late invoice for an old cycle cannot restore an old baseline.
  if (base != null)
    await tx.billingAccount.updateMany({
      where: { id: accountId, OR: [{ paidThrough: null }, { paidThrough: { lte: input.periodEnd } }] },
      data: { aiBudgetMonthlyMicros: monthly },
    })
  await grant(tx, {
    accountId,
    clientSiteId: null,
    kind: 'BUDGET',
    source: fullPeriod ? 'PAID_BASE_BUDGET' : 'PAID_BUDGET',
    amount,
    periodStart: input.periodStart,
    expiresAt: input.periodEnd,
    idempotencyKey: `ai-invoice:${invoice.id}`,
  })
  await tx.aiAllowanceInvoice.create({
    data: { id: invoice.id, accountId, grantedMicros: amount, policyVersion: BILLING_POLICY_VERSION },
  })
  if (amount > 0)
    await tx.articleTranslation.updateMany({
      where: {
        clientSite: { billingAccountId: accountId },
        error: 'AI_ALLOWANCE_EXHAUSTED',
        aiRetryAt: { not: null },
      },
      data: { aiRetryAt: null },
    })
}

const recover = async (tx: DatabaseTransaction, accountId: string, now: Date) => {
  const abandoned = await tx.aiUsageReservation.findMany({
    where: { accountId, status: 'RESERVED', expiresAt: { lte: now } },
  })
  for (const item of abandoned) {
    // A disconnected worker may have delivered a result: uncertain work cannot mint capacity again.
    await tx.aiUsageReservation.update({
      where: { id: item.id },
      data: {
        status: 'UNKNOWN',
        charged: item.reserved,
        completedAt: now,
      },
    })
  }
}

/** The article grants a reserved article operation on this account draws from; their funding is its to spend. */
const purchasesOf = async (
  tx: DatabaseTransaction,
  accountId: string,
  clientSiteId: string,
  metadata: Record<string, unknown>,
  now: Date,
) => {
  if (typeof metadata.articleOperationId !== 'string') return []
  const operation = await tx.articleCreditOperation.findFirst({
    where: { id: metadata.articleOperationId, accountId, clientSiteId, status: 'RESERVED', expiresAt: { gt: now } },
    select: { allocations: true },
  })
  return operation ? (operation.allocations as Allocation).map((allocation) => allocation.id) : []
}

const spendableGrants = (
  tx: DatabaseTransaction,
  accountId: string,
  kind: AiAllowanceKind,
  purchaseIds: string[],
  now: Date,
) =>
  tx.aiAllowanceGrant.findMany({
    where: {
      accountId,
      kind,
      remaining: { gt: 0 },
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        {
          OR: [
            { source: { notIn: ARTICLE_FUNDING_SOURCES } },
            { idempotencyKey: { in: purchaseIds.map(articleFundingKey) } },
          ],
        },
      ],
    },
    orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }, { id: 'asc' }],
  })

/**
 * An agency blog's own packs and the funding of its own bought articles, from before it joined. Used only when they
 * cover the whole call, because one reservation draws from one account. Its DIRECT account is locked before the pool.
 */
const ownGrants = async (
  tx: DatabaseTransaction,
  site: ClientSite,
  kind: AiAllowanceKind,
  amount: number,
  metadata: Record<string, unknown>,
  now: Date,
) => {
  if (!site.billingAccountId || !hasAiPlan(site.plan)) return null
  const purchaseIds = await purchasesOf(tx, site.id, site.id, metadata, now)
  const owned = await tx.aiAllowanceGrant.count({
    where: {
      accountId: site.id,
      kind,
      remaining: { gt: 0 },
      source: { notIn: ARTICLE_FUNDING_SOURCES },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  })
  if (!owned && !purchaseIds.length) return null
  const account = await lockBillingAccount(tx, site.id)
  // Never `fund`: its plan terms would read the agency's plan as the blog's own and mint an allowance.
  if (purchaseIds.length) await fundArticles(tx, site.id, purchaseIds)
  await recover(tx, site.id, now)
  const grants = await spendableGrants(tx, site.id, kind, purchaseIds, now)
  const debtField = costDebtField(kind)
  const debt = debtField ? site[debtField] : 0
  if (grants.reduce((total, row) => total + row.remaining, 0) < amount + debt) return null
  return { account, grants, renewsAt: null }
}

const poolGrants = async (
  tx: DatabaseTransaction,
  site: ClientSite,
  kind: AiAllowanceKind,
  metadata: Record<string, unknown>,
  now: Date,
) => {
  const account = await lockBillingAccount(tx, spendingAccountId(site))
  const purchaseIds = await purchasesOf(tx, account.id, site.id, metadata, now)
  const period = await fund(tx, site, account, now, purchaseIds)
  if (!period)
    throw createError({ statusCode: 403, message: 'AI plan is not active', data: { code: 'AI_PLAN_REQUIRED' } })
  await recover(tx, account.id, now)
  return { account, grants: await spendableGrants(tx, account.id, kind, purchaseIds, now), renewsAt: period.end }
}

export const reserveAiAllowance = async (
  clientSiteId: string,
  kind: AiAllowanceKind,
  amount = 1,
  metadata: Record<string, unknown> = {},
) => {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2_000_000_000)
    throw new RangeError('Invalid AI reservation')
  return prisma.$transaction(async (tx) => {
    const site = await lockBlog(tx, clientSiteId, { live: true })
    const now = new Date()
    const { account, grants, renewsAt } =
      (await ownGrants(tx, site, kind, amount, metadata, now)) ?? (await poolGrants(tx, site, kind, metadata, now))
    const accountId = account.id
    // Bought and carried articles spend their own funding first; overrun debt is the shared budget's.
    const funding = grants.filter((row) => ARTICLE_FUNDING_SOURCES.includes(row.source))
    const shared = grants.filter((row) => !ARTICLE_FUNDING_SOURCES.includes(row.source))
    const debtField = costDebtField(kind)
    const debt = debtField ? debtOf(site, account, debtField) : 0
    if (grants.reduce((total, row) => total + row.remaining, 0) < amount + debt) {
      // Not awaited: the blog row stays locked until this transaction ends.
      if (isInternalAiAllowance(kind))
        void reportCaughtError('AI cost cap reached', new Error('AI_COST_CAP_REACHED'), {
          clientSiteId,
          accountId,
          kind,
          plan: site.plan,
          task: metadata.task,
        })
      throw createError({
        statusCode: 402,
        message: 'AI allowance exhausted',
        data: {
          code: 'AI_ALLOWANCE_EXHAUSTED',
          kind,
          renewsAt: renewsAt?.toISOString() ?? null,
        },
      })
    }
    if (debt && debtField) {
      let unpaid = debt
      const corrections: Allocation = []
      for (const row of [...shared, ...funding]) {
        const used = Math.min(unpaid, row.remaining)
        if (!used) continue
        await tx.aiAllowanceGrant.update({ where: { id: row.id }, data: { remaining: { decrement: used } } })
        corrections.push({ id: row.id, amount: used })
        row.remaining -= used
        unpaid -= used
      }
      await tx.aiUsageReservation.create({
        data: {
          accountId,
          clientSiteId,
          kind,
          reserved: debt,
          charged: debt,
          status: 'COMPLETED',
          allocations: corrections,
          metadata: { correction: 'provider-cost-overrun' },
          expiresAt: now,
          completedAt: now,
        },
      })
      await updateAccountTerms(tx, account, { [debtField]: 0 })
    }
    const allocations: Allocation = []
    let needed = amount
    for (const row of [...funding, ...shared]) {
      if (!needed) break
      const used = Math.min(needed, row.remaining)
      await tx.aiAllowanceGrant.update({ where: { id: row.id }, data: { remaining: { decrement: used } } })
      allocations.push({ id: row.id, amount: used })
      needed -= used
    }
    return tx.aiUsageReservation.create({
      data: {
        id: randomUUID(),
        accountId,
        clientSiteId,
        kind,
        reserved: amount,
        allocations,
        metadata: toDatabaseJson(metadata),
        expiresAt: new Date(now.getTime() + 30 * 60_000),
      },
    })
  })
}

/** Settles against the account that was reserved from, even if the blog has since moved. */
export const settleAiAllowance = async (
  reservation: Pick<AiUsageReservation, 'id' | 'clientSiteId'>,
  charged: number | null,
) => {
  const overrun = await prisma.$transaction(async (tx) => {
    await lockBlog(tx, reservation.clientSiteId, { live: true })
    const row = await tx.aiUsageReservation.findFirstOrThrow({
      where: { id: reservation.id, clientSiteId: reservation.clientSiteId },
    })
    if (row.status !== 'RESERVED') return
    const account = await lockBillingAccount(tx, row.accountId)
    if (charged !== null && (!Number.isSafeInteger(charged) || charged < 0))
      throw new RangeError('Invalid AI settlement')
    const used = charged === null ? row.reserved : Math.min(charged, row.reserved)
    let refund = row.reserved - used
    for (const allocation of [...(row.allocations as Allocation)].reverse()) {
      const returned = Math.min(refund, allocation.amount)
      if (returned)
        await tx.aiAllowanceGrant.update({ where: { id: allocation.id }, data: { remaining: { increment: returned } } })
      refund -= returned
    }
    await tx.aiUsageReservation.update({
      where: { id: row.id },
      data: {
        charged: charged ?? row.reserved,
        status: charged === null ? 'UNKNOWN' : 'COMPLETED',
        completedAt: new Date(),
      },
    })
    if (charged !== null && charged > row.reserved) {
      const debtField = costDebtField(row.kind)
      if (debtField) await updateAccountTerms(tx, account, { [debtField]: { increment: charged - row.reserved } })
      return {
        clientSiteId: row.clientSiteId,
        accountId: row.accountId,
        reservationId: row.id,
        kind: row.kind,
        charged,
        reserved: row.reserved,
      }
    }
  })
  if (overrun)
    await reportCaughtError('AI cost exceeded reservation', new Error('AI_RESERVATION_UNDERESTIMATE'), overrun)
}

export const withAiAllowance = async <T>(
  clientSiteId: string,
  kind: Exclude<AiAllowanceKind, 'BUDGET' | 'SEO'>,
  run: () => Promise<T>,
) => {
  const reservation = await reserveAiAllowance(clientSiteId, kind)
  let result: T
  try {
    result = await run()
  } catch (error) {
    await settleAiAllowance(reservation, 0).catch((failure) =>
      reportCaughtError('AI allowance release failed', failure, { clientSiteId }),
    )
    throw error
  }
  // An accounting outage must not turn a delivered customer result into a failed operation.
  await settleAiAllowance(reservation, 1).catch((error) =>
    reportCaughtError('AI allowance settlement failed', error, { clientSiteId }),
  )
  return result
}

/** A pack is the blog's own purchase; it lands on the blog's DIRECT account. */
export const creditAiUsagePack = async (
  clientSiteId: string,
  packId: keyof typeof AI_USAGE_PACKS,
  purchaseId: string,
) => {
  const pack = AI_USAGE_PACKS[packId]
  if (!pack || !purchaseId) throw new RangeError('Invalid AI pack')
  await prisma.$transaction(async (tx) => {
    await lockBlog(tx, clientSiteId, { live: true })
    await lockBillingAccount(tx, clientSiteId)
    for (const kind of AI_ALLOWANCE_KINDS)
      await grant(tx, {
        accountId: clientSiteId,
        clientSiteId,
        kind,
        source: 'PURCHASE',
        amount: pack[kind],
        idempotencyKey: `ai-pack:${purchaseId}:${kind}`,
      })
    await tx.articleTranslation.updateMany({
      where: { clientSiteId, error: 'AI_ALLOWANCE_EXHAUSTED', aiRetryAt: { not: null } },
      data: { aiRetryAt: null },
    })
    await tx.websiteImport.updateMany({
      where: { clientSiteId, status: 'PENDING', errorCode: 'AI_ALLOWANCE_EXHAUSTED' },
      data: { leaseUntil: null },
    })
  })
}

export const getAiAllowance = async (clientSiteId: string) =>
  prisma.$transaction(async (tx) => {
    const { site, account } = await lockBlogAccount(tx, clientSiteId, { live: true })
    const now = new Date()
    const period = await fund(tx, site, account, now)
    await recover(tx, account.id, now)
    const rowsOf = (accountId: string) =>
      tx.aiAllowanceGrant.findMany({
        where: {
          accountId,
          source: { notIn: ARTICLE_FUNDING_SOURCES },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { kind: true, amount: true, remaining: true, source: true },
      })
    const rows = await rowsOf(account.id)
    // An agency blog also spends its own packs from before it joined; their debt is the blog's own.
    const own = account.kind === 'AGENCY' && period ? await rowsOf(site.id) : []
    const sum = (list: typeof rows, kind: string, field: 'amount' | 'remaining') =>
      list.filter((row) => row.kind === kind).reduce((total, row) => total + row[field], 0)
    return {
      active: period !== null,
      pooled: account.kind === 'AGENCY',
      renewsAt: period?.end.toISOString() ?? null,
      trial: period?.trial ?? false,
      allowances: AI_ALLOWANCE_KINDS.map((kind) => {
        const debtField = costDebtField(kind)
        return {
          kind,
          included: rows
            .filter((row) => row.kind === kind && row.source !== 'PURCHASE')
            .reduce((total, row) => total + row.amount, 0),
          total: sum(rows, kind, 'amount') + sum(own, kind, 'amount'),
          remaining:
            Math.max(0, sum(rows, kind, 'remaining') - (debtField ? debtOf(site, account, debtField) : 0)) +
            (own.length ? Math.max(0, sum(own, kind, 'remaining') - (debtField ? site[debtField] : 0)) : 0),
        }
      }),
    }
  })

/** Why a BUDGET-funded call would be refused right now; the reservation still decides the exact amount. */
export const aiBudgetError = async (clientSiteId: string) => {
  const allowance = await getAiAllowance(clientSiteId)
  if (!allowance.active) return 'AI_PLAN_REQUIRED' as const
  const budget = allowance.allowances.find((row) => row.kind === 'BUDGET')
  return budget && budget.remaining > 0 ? null : ('AI_ALLOWANCE_EXHAUSTED' as const)
}

/** An agency's AI budget for its overview, read without funding a period. */
export const getAccountAiBudget = async (accountId: string) => {
  const now = new Date()
  const [rows, account] = await Promise.all([
    prisma.aiAllowanceGrant.findMany({
      where: {
        accountId,
        kind: 'BUDGET',
        source: { notIn: ARTICLE_FUNDING_SOURCES },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { amount: true, remaining: true },
    }),
    prisma.billingAccount.findUniqueOrThrow({ where: { id: accountId }, select: { aiBudgetDebtMicros: true } }),
  ])
  const total = rows.reduce((sum, row) => sum + row.amount, 0)
  const remaining = rows.reduce((sum, row) => sum + row.remaining, 0) - account.aiBudgetDebtMicros
  return { total, remaining: Math.max(0, remaining) }
}

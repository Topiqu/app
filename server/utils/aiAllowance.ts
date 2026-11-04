import type Stripe from 'stripe'
import type { AiAllowanceKind } from '~~/shared/utils/billingCatalog'
import type { AiUsageReservation, ClientSite } from '~~/generated/zenstack/models'

import { randomUUID } from 'node:crypto'
import { ARTICLE_PACK_LIST } from '~~/shared/utils/articlePacks'
import { nextArticleCreditMonth } from '~~/shared/utils/articleCredits'
import {
  AI_ALLOWANCES,
  AI_ALLOWANCE_KINDS,
  AI_USAGE_PACKS,
  BILLING_POLICY_VERSION,
} from '~~/shared/utils/billingCatalog'

type Allocation = { id: string; amount: number }[]
type AllowanceSite = Pick<
  ClientSite,
  | 'id'
  | 'plan'
  | 'createdAt'
  | 'trialStartedAt'
  | 'trialEndsAt'
  | 'firstPaidAt'
  | 'billingPlan'
  | 'billingProvider'
  | 'stripeSubscriptionId'
  | 'paidTeamSeats'
  | 'aiBudgetMonthlyMicros'
>

const lockSite = async (tx: DatabaseTransaction, id: string) => {
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM "ClientSite" WHERE id = ${id} AND "deletedAt" IS NULL FOR UPDATE`
  if (!rows.length) throw createError({ statusCode: 404, message: 'Blog not found' })
  return tx.clientSite.findUniqueOrThrow({ where: { id } })
}

const grant = async (
  tx: DatabaseTransaction,
  data: {
    clientSiteId: string
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
    stored.clientSiteId !== data.clientSiteId ||
    stored.kind !== data.kind ||
    stored.amount !== data.amount ||
    stored.source !== data.source
  )
    throw createError({ statusCode: 409, message: 'AI grant key already used' })
}

const fund = async (tx: DatabaseTransaction, site: AllowanceSite, now: Date, purchaseIds: string[] = []) => {
  if (!['PRO', 'PREMIUM', 'CUSTOM'].includes(site.plan)) return null
  const trial = Boolean(
    site.trialStartedAt && !site.firstPaidAt && site.billingPlan !== 'PERMANENT' && site.plan !== 'CUSTOM',
  )
  if (trial && (!site.trialEndsAt || site.trialEndsAt <= now)) return null
  const included = AI_ALLOWANCES[trial ? 'TRIAL' : (site.plan as 'PRO' | 'PREMIUM' | 'CUSTOM')]
  const latest = trial
    ? null
    : await tx.articleCreditGrant.findFirst({
        where: { clientSiteId: site.id, source: 'PLAN', periodStart: { lte: now }, expiresAt: { gt: now } },
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
  for (const kind of AI_ALLOWANCE_KINDS) {
    // An invoice funds this billing cycle explicitly, including discounts and prorations.
    // Annual continuation slots have no invoice and use the stored monthly base allocation.
    if (
      kind === 'BUDGET' &&
      !trial &&
      (await tx.aiAllowanceGrant.count({
        where: {
          clientSiteId: site.id,
          kind,
          source: { in: ['PAID_BASE_BUDGET', 'PAID_BUDGET'] },
          periodStart: start,
        },
      }))
    )
      continue
    const ceiling =
      kind === 'BUDGET' && !trial
        ? (site.aiBudgetMonthlyMicros ?? Math.round(included.BUDGET * (site.billingPlan === 'ANNUAL' ? 0.8 : 1)))
        : included[kind]
    const existing = await tx.aiAllowanceGrant.aggregate({
      where: { clientSiteId: site.id, kind, source: trial ? 'TRIAL' : 'PLAN', periodStart: start },
      _sum: { amount: true },
    })
    const amount = Math.max(0, ceiling - (existing._sum.amount ?? 0))
    await grant(tx, {
      clientSiteId: site.id,
      kind,
      amount,
      source: trial ? 'TRIAL' : 'PLAN',
      periodStart: start,
      expiresAt: end,
      idempotencyKey: `included:${BILLING_POLICY_VERSION}:${site.id}:${start.toISOString()}:${kind}:${ceiling}`,
    })
  }
  // Existing bought articles retain separately funded capacity; this never consumes their balance.
  const purchases = await tx.articleCreditGrant.findMany({
    where: { clientSiteId: site.id, source: 'PURCHASE', OR: [{ remaining: { gt: 0 } }, { id: { in: purchaseIds } }] },
    select: { id: true, amount: true },
  })
  for (const purchase of purchases) {
    const pack = ARTICLE_PACK_LIST.find((candidate) => candidate.articles === purchase.amount)
    const funded = pack ? pack.priceUsd : purchase.amount * (22.49 / 25)
    await grant(tx, {
      clientSiteId: site.id,
      kind: 'BUDGET',
      amount: Math.round(funded * 0.15 * 1_000_000),
      source: 'ARTICLE_PURCHASE',
      idempotencyKey: `article-funding:${purchase.id}`,
    })
  }
  return { start, end, trial }
}

/** Stripe line amounts exclude tax; recurring discounts are applied separately. */
export const invoiceBaseNetCents = (invoice: Stripe.Invoice, priceId?: string): number | null => {
  if (invoice.currency !== 'usd' || invoice.lines.has_more) return null
  let total = 0
  let known = false
  for (const line of invoice.lines.data) {
    const rawPrice = line.pricing?.price_details?.price
    const id = typeof rawPrice === 'string' ? rawPrice : rawPrice?.id
    if (!id || (priceId ? id !== priceId : !planFromPriceId(id)) || !Number.isSafeInteger(line.amount)) continue
    known = true
    total += line.amount - (line.discount_amounts ?? []).reduce((sum, discount) => sum + discount.amount, 0)
  }
  return known ? total : null
}

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
  if (!invoice.id || invoice.currency !== 'usd') return
  const previous = await tx.aiAllowanceInvoice.findUnique({ where: { id: invoice.id } })
  if (previous) {
    if (previous.clientSiteId !== clientSiteId) throw new Error('AI invoice tenant mismatch')
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
        where: { clientSiteId, source: 'PLAN', periodStart: { lte: new Date() }, expiresAt: { gt: new Date() } },
        orderBy: { periodStart: 'asc' },
        select: { periodStart: true, periodEnd: true },
      })
  const start = currentCycle?.periodStart ?? input.periodStart
  const end = currentCycle?.periodEnd ?? input.periodEnd
  if (!start || !end) return
  const existing = await tx.aiAllowanceGrant.aggregate({
    where: {
      clientSiteId,
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
    ? Math.max(0, Math.floor((netCents * 1500) / (annual ? 12 : 1)))
    : currentBase != null
      ? Math.max(0, Math.floor((currentBase * 1500) / (annual ? 12 : 1)))
      : (stored.aiBudgetMonthlyMicros ?? 0)
  const amount = fullPeriod
    ? Math.max(0, monthly - (existing._sum.amount ?? 0))
    : Math.min(Math.max(0, Math.floor(netCents * 1500)), Math.max(0, monthly - (existing._sum.amount ?? 0)))
  // A late invoice for an old price may fund its own cycle but cannot restore an old baseline.
  if (currentBase != null)
    await tx.clientSite.updateMany({
      where: {
        id: clientSiteId,
        OR: [{ paidThrough: null }, { paidThrough: { lte: input.servicePeriodEnd ?? input.periodEnd } }],
      },
      data: { aiBudgetMonthlyMicros: Math.max(0, Math.floor((currentBase * 1500) / (annual ? 12 : 1))) },
    })
  await grant(tx, {
    clientSiteId,
    kind: 'BUDGET',
    source: fullPeriod ? 'PAID_BASE_BUDGET' : 'PAID_BUDGET',
    amount,
    periodStart: start,
    expiresAt: end,
    idempotencyKey: `ai-invoice:${invoice.id}`,
  })
  await tx.aiAllowanceInvoice.create({
    data: { id: invoice.id, clientSiteId, grantedMicros: amount, policyVersion: BILLING_POLICY_VERSION },
  })
  if (amount > 0)
    await tx.articleTranslation.updateMany({
      where: { clientSiteId, error: 'AI_ALLOWANCE_EXHAUSTED', aiRetryAt: { not: null } },
      data: { aiRetryAt: null },
    })
}

const recover = async (tx: DatabaseTransaction, clientSiteId: string, now: Date) => {
  const abandoned = await tx.aiUsageReservation.findMany({
    where: { clientSiteId, status: 'RESERVED', expiresAt: { lte: now } },
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

export const reserveAiAllowance = async (
  clientSiteId: string,
  kind: AiAllowanceKind,
  amount = 1,
  metadata: Record<string, unknown> = {},
) => {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2_000_000_000)
    throw new RangeError('Invalid AI reservation')
  return prisma.$transaction(async (tx) => {
    const site = await lockSite(tx, clientSiteId)
    const now = new Date()
    const articleOperation =
      typeof metadata.articleOperationId === 'string'
        ? await tx.articleCreditOperation.findFirst({
            where: { id: metadata.articleOperationId, clientSiteId, status: 'RESERVED', expiresAt: { gt: now } },
            select: { allocations: true },
          })
        : null
    const purchaseIds = articleOperation
      ? (articleOperation.allocations as Allocation).map((allocation) => allocation.id)
      : []
    const period = await fund(tx, site, now, purchaseIds)
    if (!period)
      throw createError({ statusCode: 403, message: 'AI plan is not active', data: { code: 'AI_PLAN_REQUIRED' } })
    await recover(tx, clientSiteId, now)
    const grants = await tx.aiAllowanceGrant.findMany({
      where: {
        clientSiteId,
        kind,
        remaining: { gt: 0 },
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          {
            OR: [
              { source: { not: 'ARTICLE_PURCHASE' } },
              { idempotencyKey: { in: purchaseIds.map((id) => `article-funding:${id}`) } },
            ],
          },
        ],
      },
      orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }, { id: 'asc' }],
    })
    const debt = kind === 'BUDGET' ? site.aiBudgetDebtMicros : 0
    if (grants.reduce((total, row) => total + row.remaining, 0) < amount + debt)
      throw createError({
        statusCode: 402,
        message: 'AI allowance exhausted',
        data: {
          code: 'AI_ALLOWANCE_EXHAUSTED',
          kind,
          renewsAt: period.end.toISOString(),
        },
      })
    if (debt) {
      let unpaid = debt
      const corrections: Allocation = []
      for (const row of grants) {
        const used = Math.min(unpaid, row.remaining)
        if (!used) continue
        await tx.aiAllowanceGrant.update({ where: { id: row.id }, data: { remaining: { decrement: used } } })
        corrections.push({ id: row.id, amount: used })
        row.remaining -= used
        unpaid -= used
      }
      await tx.aiUsageReservation.create({
        data: {
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
      await tx.clientSite.update({ where: { id: clientSiteId }, data: { aiBudgetDebtMicros: 0 } })
    }
    const allocations: Allocation = []
    let needed = amount
    for (const row of grants) {
      if (!needed) break
      const used = Math.min(needed, row.remaining)
      await tx.aiAllowanceGrant.update({ where: { id: row.id }, data: { remaining: { decrement: used } } })
      allocations.push({ id: row.id, amount: used })
      needed -= used
    }
    return tx.aiUsageReservation.create({
      data: {
        id: randomUUID(),
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

export const settleAiAllowance = async (
  reservation: Pick<AiUsageReservation, 'id' | 'clientSiteId'>,
  charged: number | null,
) => {
  const overrun = await prisma.$transaction(async (tx) => {
    await lockSite(tx, reservation.clientSiteId)
    const row = await tx.aiUsageReservation.findFirstOrThrow({
      where: { id: reservation.id, clientSiteId: reservation.clientSiteId },
    })
    if (row.status !== 'RESERVED') return
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
      await tx.clientSite.update({
        where: { id: row.clientSiteId },
        data: { aiBudgetDebtMicros: { increment: charged - row.reserved } },
      })
      return { clientSiteId: row.clientSiteId, reservationId: row.id, charged, reserved: row.reserved }
    }
  })
  if (overrun)
    await reportCaughtError('AI cost exceeded reservation', new Error('AI_RESERVATION_UNDERESTIMATE'), overrun)
}

export const withAiAllowance = async <T>(
  clientSiteId: string,
  kind: Exclude<AiAllowanceKind, 'BUDGET'>,
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

export const creditAiUsagePack = async (
  clientSiteId: string,
  packId: keyof typeof AI_USAGE_PACKS,
  purchaseId: string,
) => {
  const pack = AI_USAGE_PACKS[packId]
  if (!pack || !purchaseId) throw new RangeError('Invalid AI pack')
  await prisma.$transaction(async (tx) => {
    await lockSite(tx, clientSiteId)
    for (const kind of AI_ALLOWANCE_KINDS)
      await grant(tx, {
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
  })
}

export const getAiAllowance = async (clientSiteId: string) =>
  prisma.$transaction(async (tx) => {
    const site = await lockSite(tx, clientSiteId)
    const now = new Date()
    const period = await fund(tx, site, now)
    await recover(tx, clientSiteId, now)
    const rows = await tx.aiAllowanceGrant.findMany({
      where: {
        clientSiteId,
        source: { not: 'ARTICLE_PURCHASE' },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { kind: true, amount: true, remaining: true, source: true },
    })
    return {
      active: period !== null,
      renewsAt: period?.end.toISOString() ?? null,
      trial: period?.trial ?? false,
      allowances: AI_ALLOWANCE_KINDS.map((kind) => ({
        kind,
        included: rows
          .filter((row) => row.kind === kind && row.source !== 'PURCHASE')
          .reduce((total, row) => total + row.amount, 0),
        total: rows.filter((row) => row.kind === kind).reduce((total, row) => total + row.amount, 0),
        remaining: Math.max(
          0,
          rows.filter((row) => row.kind === kind).reduce((total, row) => total + row.remaining, 0) -
            (kind === 'BUDGET' ? site.aiBudgetDebtMicros : 0),
        ),
      })),
    }
  })

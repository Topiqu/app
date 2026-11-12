import type { JsonValue } from '@zenstackhq/orm'
import type { ArticleCreditOperation, BillingAccount, ClientSite } from '~~/generated/zenstack/models'

import { randomUUID } from 'node:crypto'
import { hasAiPlan } from '~~/shared/utils/plans'
import { agencyRolloverCap, isAgencyLive } from '~~/shared/utils/agencyPlan'

type Tx = DatabaseTransaction
type Allocation = { id: string; amount: number }[]
type Owner = { accountId: string; clientSiteId: string | null }

const validateAmount = (amount: number) => {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Article credit amount must be a positive integer')
}

const ensureWallet = (tx: Tx, accountId: string) =>
  tx.articleCreditWallet.upsert({ where: { id: accountId }, create: { id: accountId }, update: {} })

// Expiring credits first, then carried plan credits, then purchased and admin credits.
const spendOrder = <T extends { source: string; expiresAt: Date | null }>(grants: T[]) => {
  const rank = (grant: T) => (grant.expiresAt ? 0 : grant.source === 'ROLLOVER' ? 1 : 2)
  return grants.sort((a, b) => rank(a) - rank(b))
}

const rolloverCap = async (tx: Tx, account: BillingAccount) => {
  if (account.kind === 'AGENCY') return isAgencyLive(account.status) ? agencyRolloverCap(account.unitBlocks) : 0
  const site = await tx.clientSite.findUniqueOrThrow({ where: { id: account.id }, select: { plan: true } })
  return articleRolloverCap(site.plan)
}

async function expireCredits(tx: Tx, grant: { id: string } & Owner, amount: number) {
  await tx.articleCreditGrant.update({ where: { id: grant.id }, data: { remaining: { decrement: amount } } })
  await tx.articleCreditWallet.update({ where: { id: grant.accountId }, data: { balance: { decrement: amount } } })
  await tx.articleCreditLedgerEntry.create({
    data: {
      accountId: grant.accountId,
      clientSiteId: grant.clientSiteId,
      grantId: grant.id,
      kind: 'EXPIRE',
      amount: -amount,
      reason: 'Article credits expired',
      // A held allocation can be returned after this grant's available portion already expired.
      idempotencyKey: `expire:${grant.id}:${randomUUID()}`,
    },
  })
}

async function expireAvailableGrants(tx: Tx, account: BillingAccount) {
  const accountId = account.id
  const carried = await tx.articleCreditGrant.findMany({
    where: { accountId, source: 'ROLLOVER', remaining: { gt: 0 } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  // A downgrade trims carried credits to the new cap; leaving the paid AI plans drops them.
  let room = (await rolloverCap(tx, account)) - carried.reduce((total, grant) => total + grant.remaining, 0)
  for (const grant of carried) {
    if (room >= 0) break
    const lapsed = Math.min(grant.remaining, -room)
    await expireCredits(tx, grant, lapsed)
    room += lapsed
  }

  const expired = await tx.articleCreditGrant.findMany({
    where: { accountId, remaining: { gt: 0 }, expiresAt: { lte: new Date() } },
    orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  })
  for (const grant of expired) {
    const carry = grant.source === 'PLAN' ? Math.min(grant.remaining, Math.max(0, room)) : 0
    if (carry) {
      room -= carry
      await tx.articleCreditGrant.update({ where: { id: grant.id }, data: { remaining: { decrement: carry } } })
      const next = await tx.articleCreditGrant.create({
        data: {
          accountId,
          clientSiteId: grant.clientSiteId,
          source: 'ROLLOVER',
          amount: carry,
          remaining: carry,
          policyVersion: ARTICLE_CREDIT_POLICY_VERSION,
          idempotencyKey: `rollover:${grant.id}:${randomUUID()}`,
        },
      })
      // The balance does not change; the entry links the carried grant to the period it came from.
      await tx.articleCreditLedgerEntry.create({
        data: {
          accountId,
          clientSiteId: grant.clientSiteId,
          grantId: next.id,
          kind: 'ROLLOVER',
          amount: 0,
          reason: `Carried over from ${grant.id}`,
          idempotencyKey: `ledger:${next.idempotencyKey}`,
        },
      })
    }
    if (grant.remaining > carry) await expireCredits(tx, grant, grant.remaining - carry)
  }
}

async function releaseExpiredOperations(tx: Tx, accountId: string) {
  const operations = await tx.articleCreditOperation.findMany({
    where: { accountId, status: 'RESERVED', expiresAt: { lte: new Date() } },
  })
  for (const operation of operations) {
    for (const allocation of operation.allocations as Allocation)
      await tx.articleCreditGrant.update({
        where: { id: allocation.id },
        data: { remaining: { increment: allocation.amount } },
      })
    await tx.articleCreditOperation.update({
      where: { id: operation.id },
      data: { status: 'EXPIRED', completedAt: new Date() },
    })
    await tx.articleCreditWallet.update({
      where: { id: accountId },
      data: { reserved: { decrement: operation.reserved } },
    })
    await tx.articleCreditLedgerEntry.create({
      data: {
        accountId,
        clientSiteId: operation.clientSiteId,
        operationId: operation.id,
        kind: 'RELEASE',
        amount: 0,
        reason: 'Expired article reservation released',
        idempotencyKey: `expire-operation:${operation.id}`,
      },
    })
  }
}

/** The calling transaction holds the account lock. */
async function walletView(tx: Tx, account: BillingAccount) {
  await ensureWallet(tx, account.id)
  await releaseExpiredOperations(tx, account.id)
  await expireAvailableGrants(tx, account)
  const wallet = await tx.articleCreditWallet.findUniqueOrThrow({ where: { id: account.id } })
  const grants = await tx.articleCreditGrant.findMany({
    where: { accountId: account.id, remaining: { gt: 0 } },
    orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
    select: { id: true, source: true, remaining: true, expiresAt: true, periodEnd: true },
  })
  return {
    ...wallet,
    pooled: account.kind === 'AGENCY',
    available: wallet.balance - wallet.reserved,
    grants: spendOrder(grants),
  }
}

/** The account's current billing period, or the last 30 days when it has none. */
const periodStartOf = async (tx: Tx, accountId: string) => {
  const now = new Date()
  const slot = await tx.articleCreditGrant.findFirst({
    where: { accountId, source: 'PLAN', periodStart: { lte: now }, expiresAt: { gt: now } },
    orderBy: { periodStart: 'asc' },
    select: { periodStart: true },
  })
  return slot?.periodStart ?? new Date(now.getTime() - 30 * 86400000)
}

/** Units this blog has spent or holds from its account in the current period. */
export const blogUnitsUsed = async (tx: Tx, site: Pick<ClientSite, 'id'>, accountId: string) => {
  const used = await tx.articleCreditOperation.aggregate({
    where: {
      accountId,
      clientSiteId: site.id,
      status: { in: ['RESERVED', 'COMPLETED'] },
      createdAt: { gte: await periodStartOf(tx, accountId) },
    },
    _sum: { reserved: true },
  })
  return used._sum.reserved ?? 0
}

/** Direct-subscription credits land on the blog's own account unless an account is named. */
export async function creditArticleCredits(
  input: {
    clientSiteId?: string | null
    accountId?: string
    amount: number
    source: 'TRIAL' | 'PLAN' | 'PURCHASE' | 'BONUS' | 'ADMIN' | 'ROLLOVER'
    idempotencyKey: string
    reason: string
    expiresAt?: Date | null
    periodStart?: Date | null
    periodEnd?: Date | null
    policyVersion?: string
    ledgerKind?: 'CREDIT' | 'BONUS' | 'REFUND'
    operationId?: string
  },
  transaction?: Tx,
) {
  validateAmount(input.amount)
  const accountId = input.accountId ?? input.clientSiteId
  if (!accountId) throw new Error('Article credits need an owner')
  const clientSiteId = input.clientSiteId ?? null
  const write = async (tx: Tx) => {
    if (clientSiteId) await lockBlog(tx, clientSiteId)
    await lockBillingAccount(tx, accountId)
    await ensureWallet(tx, accountId)
    const previous = await tx.articleCreditGrant.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
    if (previous) {
      if (
        previous.accountId !== accountId ||
        previous.clientSiteId !== clientSiteId ||
        previous.amount !== input.amount ||
        previous.source !== input.source
      )
        throw createError({ statusCode: 409, message: 'Article credit grant key already used' })
      return previous
    }

    const grant = await tx.articleCreditGrant.create({
      data: {
        accountId,
        clientSiteId,
        source: input.source,
        amount: input.amount,
        remaining: input.amount,
        expiresAt: input.expiresAt,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        policyVersion: input.policyVersion ?? ARTICLE_CREDIT_POLICY_VERSION,
        idempotencyKey: input.idempotencyKey,
      },
    })
    await tx.articleCreditWallet.update({
      where: { id: accountId },
      data: { balance: { increment: input.amount } },
    })
    await tx.articleCreditLedgerEntry.create({
      data: {
        accountId,
        clientSiteId,
        grantId: grant.id,
        kind: input.ledgerKind ?? 'CREDIT',
        amount: input.amount,
        operationId: input.operationId,
        reason: input.reason,
        idempotencyKey: `ledger:${input.idempotencyKey}`,
      },
    })
    return grant
  }
  return transaction ? write(transaction) : prisma.$transaction(write)
}

/** One period's included units. A mid-period upgrade adds only the difference. */
export async function grantPlanArticleCredits(
  tx: Tx,
  input: {
    clientSiteId?: string
    accountId?: string
    plan?: string
    amount?: number
    idempotencyKey: string
    reason: string
    periodStart: Date
    periodEnd: Date
  },
) {
  const amount = input.amount ?? articleCreditsForPlan(input.plan)
  const accountId = input.accountId ?? input.clientSiteId
  if (amount <= 0 || !accountId) return
  // Replayed billing events keep their original grant even if the allowance policy changed.
  const previous = await tx.articleCreditGrant.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
  if (previous) {
    if (previous.accountId !== accountId || previous.source !== 'PLAN')
      throw createError({ statusCode: 409, message: 'Article credit grant key already used' })
    return previous
  }
  // Downgrades never claw back articles already granted.
  const active = await tx.articleCreditGrant.aggregate({
    where: { accountId, source: 'PLAN', expiresAt: { gt: input.periodStart } },
    _sum: { amount: true },
  })
  const grantAmount = Math.max(0, amount - (active._sum.amount ?? 0))
  if (grantAmount > 0)
    await creditArticleCredits(
      {
        accountId,
        clientSiteId: input.clientSiteId,
        amount: grantAmount,
        source: 'PLAN',
        idempotencyKey: input.idempotencyKey,
        reason: input.reason,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        expiresAt: input.periodEnd,
      },
      tx,
    )
}

/** Admin corrections act on the pool the blog spends from; a refund returns to the pool that was charged. */
export async function adjustArticleCredits(input: {
  clientSiteId: string
  amount: number
  kind: 'CREDIT' | 'BONUS' | 'DEBIT' | 'REFUND'
  reason: string
  key: string
  operationId?: string
}) {
  validateAmount(input.amount)
  if (input.kind === 'REFUND') {
    if (!input.operationId)
      throw createError({ statusCode: 400, message: 'A refund must reference a completed article operation' })
    return prisma.$transaction(async (tx) => {
      await lockBlog(tx, input.clientSiteId)
      const previous = await tx.articleCreditGrant.findUnique({ where: { idempotencyKey: `admin:${input.key}` } })
      if (previous) {
        if (previous.clientSiteId !== input.clientSiteId || previous.amount !== input.amount)
          throw createError({ statusCode: 409, message: 'Article refund key already used' })
        return previous
      }
      const operation = await tx.articleCreditOperation.findFirst({
        where: { id: input.operationId, clientSiteId: input.clientSiteId, status: 'COMPLETED', charged: { gt: 0 } },
      })
      if (!operation) throw createError({ statusCode: 400, message: 'Refundable article operation not found' })
      if (input.amount !== operation.charged)
        throw createError({ statusCode: 400, message: 'Refund amount must match the operation charge' })
      const refunded = await tx.articleCreditLedgerEntry.findFirst({
        where: { operationId: operation.id, kind: 'REFUND' },
      })
      if (refunded) throw createError({ statusCode: 409, message: 'Article operation already refunded' })
      return creditArticleCredits(
        {
          accountId: operation.accountId,
          clientSiteId: input.clientSiteId,
          amount: operation.charged,
          source: 'ADMIN',
          idempotencyKey: `admin:${input.key}`,
          reason: input.reason,
          ledgerKind: 'REFUND',
          operationId: operation.id,
        },
        tx,
      )
    })
  }

  return prisma.$transaction(async (tx) => {
    const { account } = await lockBlogAccount(tx, input.clientSiteId)
    if (input.kind !== 'DEBIT')
      return creditArticleCredits(
        {
          accountId: account.id,
          clientSiteId: input.clientSiteId,
          amount: input.amount,
          source: input.kind === 'BONUS' ? 'BONUS' : 'ADMIN',
          idempotencyKey: `admin:${input.key}`,
          reason: input.reason,
          expiresAt: input.kind === 'BONUS' ? new Date(Date.now() + 30 * 24 * 60 * 60_000) : null,
          ledgerKind: input.kind,
        },
        tx,
      )

    const previous = await tx.articleCreditLedgerEntry.findUnique({ where: { idempotencyKey: `admin:${input.key}` } })
    if (previous) return previous
    const current = await walletView(tx, account)
    if (current.available < input.amount)
      throw createError({ statusCode: 409, message: 'Adjustment exceeds available article credits' })

    let remaining = input.amount
    const grants = await tx.articleCreditGrant.findMany({
      where: { accountId: account.id, remaining: { gt: 0 } },
      orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }, { id: 'asc' }],
    })
    for (const grant of spendOrder(grants)) {
      if (!remaining) break
      const used = Math.min(grant.remaining, remaining)
      await tx.articleCreditGrant.update({ where: { id: grant.id }, data: { remaining: { decrement: used } } })
      remaining -= used
    }
    await tx.articleCreditWallet.update({
      where: { id: account.id },
      data: { balance: { decrement: input.amount } },
    })
    return tx.articleCreditLedgerEntry.create({
      data: {
        accountId: account.id,
        clientSiteId: input.clientSiteId,
        kind: 'ADJUSTMENT',
        amount: -input.amount,
        reason: input.reason,
        idempotencyKey: `admin:${input.key}`,
      },
    })
  })
}

export async function reserveArticleCredit(
  clientSiteId: string,
  action: 'MANUAL_ARTICLE' | 'SCHEDULED_ARTICLE' | 'CONTENT_REFRESH',
  key: string = randomUUID(),
  metadata: JsonValue = {},
  amount = 1,
) {
  validateAmount(amount)
  return prisma.$transaction(async (tx) => {
    const { site, account } = await lockBlogAccount(tx, clientSiteId)
    const accountId = account.id
    const current = await walletView(tx, account)
    const previous = await tx.articleCreditOperation.findUnique({ where: { idempotencyKey: key } })
    if (previous) throw createError({ statusCode: 409, message: 'Operation already submitted' })
    // A paused (BASIC) agency blog keeps its place in the agency, not its share of the pool.
    if (account.kind === 'AGENCY' && !hasAiPlan(site.plan))
      throw createError({ statusCode: 403, message: 'AI plan is not active', data: { code: 'AI_PLAN_REQUIRED' } })

    if (site.monthlyUnitLimit !== null) {
      const used = await blogUnitsUsed(tx, site, accountId)
      if (used + amount > site.monthlyUnitLimit)
        throw createError({
          statusCode: 402,
          message: 'Blog unit limit reached',
          data: { code: 'BLOG_UNIT_LIMIT_REACHED', required: amount, limit: site.monthlyUnitLimit, used },
        })
    }
    if (current.available < amount)
      throw createError({
        statusCode: 402,
        message: 'Insufficient article credits',
        data: { required: amount, available: current.available },
      })

    const grants = await tx.articleCreditGrant.findMany({
      where: {
        accountId,
        remaining: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }, { id: 'asc' }],
    })
    const allocations: Allocation = []
    let remaining = amount
    for (const grant of spendOrder(grants)) {
      if (!remaining) break
      const used = Math.min(grant.remaining, remaining)
      allocations.push({ id: grant.id, amount: used })
      remaining -= used
    }
    if (remaining) throw createError({ statusCode: 409, message: 'Article credit grants do not cover the reservation' })
    for (const allocation of allocations)
      await tx.articleCreditGrant.update({
        where: { id: allocation.id },
        data: { remaining: { decrement: allocation.amount } },
      })
    const operation = await tx.articleCreditOperation.create({
      data: {
        accountId,
        clientSiteId,
        action,
        reserved: amount,
        allocations,
        metadata,
        idempotencyKey: key,
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    })
    await tx.articleCreditWallet.update({ where: { id: accountId }, data: { reserved: { increment: amount } } })
    return operation
  })
}

/** Settles against the pool that was charged, even if the blog has since moved to another account. */
export async function settleArticleCredit(
  operation: Pick<ArticleCreditOperation, 'id' | 'clientSiteId'>,
  charge: boolean,
  metadata: JsonValue = {},
  transaction?: Tx,
) {
  const write = async (tx: Tx) => {
    await lockBlog(tx, operation.clientSiteId)
    const current = await tx.articleCreditOperation.findFirstOrThrow({
      where: { id: operation.id, clientSiteId: operation.clientSiteId },
    })
    const account = await lockBillingAccount(tx, current.accountId)
    if (current.status !== 'RESERVED') return walletView(tx, account)

    if (!charge) {
      for (const allocation of current.allocations as Allocation)
        await tx.articleCreditGrant.update({
          where: { id: allocation.id },
          data: { remaining: { increment: allocation.amount } },
        })
    }

    await tx.articleCreditOperation.update({
      where: { id: current.id },
      data: {
        status: charge ? 'COMPLETED' : 'RELEASED',
        charged: charge ? current.reserved : 0,
        metadata: {
          ...(typeof current.metadata === 'object' && !Array.isArray(current.metadata) ? current.metadata : {}),
          ...(typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}),
        },
        completedAt: new Date(),
      },
    })
    await tx.articleCreditWallet.update({
      where: { id: account.id },
      data: {
        reserved: { decrement: current.reserved },
        ...(charge ? { balance: { decrement: current.reserved } } : {}),
      },
    })
    await tx.articleCreditLedgerEntry.create({
      data: {
        accountId: account.id,
        clientSiteId: operation.clientSiteId,
        operationId: current.id,
        kind: charge ? 'DEBIT' : 'RELEASE',
        amount: charge ? -current.reserved : 0,
        reason: current.action,
        idempotencyKey: `settle:${current.id}`,
      },
    })
    return walletView(tx, account)
  }
  return transaction ? write(transaction) : prisma.$transaction(write)
}

/** The wallet the blog spends from; for an agency blog this is the shared pool. */
export async function getArticleCreditWallet(clientSiteId: string, transaction?: Tx) {
  const read = async (tx: Tx) => walletView(tx, (await lockBlogAccount(tx, clientSiteId)).account)
  return transaction ? read(transaction) : prisma.$transaction(read)
}

export async function withArticleCreditReservation<T>(
  clientSiteId: string,
  action: 'MANUAL_ARTICLE' | 'SCHEDULED_ARTICLE' | 'CONTENT_REFRESH',
  work: (operation: ArticleCreditOperation) => Promise<T>,
  options: {
    key?: string
    amount?: number
    metadata?: JsonValue
    shouldCharge?: (result: T) => boolean
  } = {},
) {
  const operation = await reserveArticleCredit(clientSiteId, action, options.key, options.metadata, options.amount)
  try {
    const result = await work(operation)
    await settleArticleCredit(operation, options.shouldCharge ? options.shouldCharge(result) : true, options.metadata)
    return result
  } catch (error) {
    await settleArticleCredit(operation, false, { error: error instanceof Error ? error.message : String(error) })
    throw error
  }
}

/** An agency's shared pool, for its own overview. Locks only the account. */
export const getAccountWallet = (accountId: string) =>
  prisma.$transaction(async (tx) => walletView(tx, await lockBillingAccount(tx, accountId)))

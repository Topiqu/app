import type { JsonValue } from '@zenstackhq/orm'
import type { ArticleCreditOperation } from '~~/generated/zenstack/models'

import { randomUUID } from 'node:crypto'
import { ARTICLE_CREDIT_POLICY_VERSION } from '~~/shared/utils/articleCredits'

import type { DatabaseTransaction } from './database'

type Tx = DatabaseTransaction
type Allocation = { id: string; amount: number }[]

const validateAmount = (amount: number) => {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Article credit amount must be a positive integer')
}

async function lockWallet(tx: Tx, clientSiteId: string) {
  const sites = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "ClientSite" WHERE "id" = ${clientSiteId} FOR UPDATE`
  if (!sites[0]) throw createError({ statusCode: 404, message: 'Article wallet owner not found' })

  return tx.articleCreditWallet.upsert({
    where: { id: clientSiteId },
    create: { id: clientSiteId },
    update: {},
  })
}

async function expireAvailableGrants(tx: Tx, clientSiteId: string) {
  const expired = await tx.articleCreditGrant.findMany({
    where: { clientSiteId, remaining: { gt: 0 }, expiresAt: { lte: new Date() } },
  })
  for (const grant of expired) {
    await tx.articleCreditGrant.update({ where: { id: grant.id }, data: { remaining: 0 } })
    await tx.articleCreditWallet.update({
      where: { id: clientSiteId },
      data: { balance: { decrement: grant.remaining } },
    })
    await tx.articleCreditLedgerEntry.create({
      data: {
        clientSiteId,
        grantId: grant.id,
        kind: 'EXPIRE',
        amount: -grant.remaining,
        reason: 'Article credits expired',
        idempotencyKey: `expire:${grant.id}`,
      },
    })
  }
}

async function releaseExpiredOperations(tx: Tx, clientSiteId: string) {
  const operations = await tx.articleCreditOperation.findMany({
    where: { clientSiteId, status: 'RESERVED', expiresAt: { lte: new Date() } },
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
    await tx.articleCreditWallet.update({ where: { id: clientSiteId }, data: { reserved: { decrement: 1 } } })
    await tx.articleCreditLedgerEntry.create({
      data: {
        clientSiteId,
        operationId: operation.id,
        kind: 'RELEASE',
        amount: 0,
        reason: 'Expired article reservation released',
        idempotencyKey: `expire-operation:${operation.id}`,
      },
    })
  }
}

export async function creditArticleCredits(
  input: {
    clientSiteId: string
    amount: number
    source: 'TRIAL' | 'PLAN' | 'PURCHASE' | 'BONUS' | 'ADMIN'
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
  const write = async (tx: Tx) => {
    await lockWallet(tx, input.clientSiteId)
    const previous = await tx.articleCreditGrant.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
    if (previous) {
      if (
        previous.clientSiteId !== input.clientSiteId ||
        previous.amount !== input.amount ||
        previous.source !== input.source
      )
        throw createError({ statusCode: 409, message: 'Article credit grant key already used' })
      return previous
    }

    const grant = await tx.articleCreditGrant.create({
      data: {
        clientSiteId: input.clientSiteId,
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
      where: { id: input.clientSiteId },
      data: { balance: { increment: input.amount } },
    })
    await tx.articleCreditLedgerEntry.create({
      data: {
        clientSiteId: input.clientSiteId,
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
    if (!input.operationId || input.amount !== 1)
      throw createError({ statusCode: 400, message: 'A refund must reference one completed article operation' })
    return prisma.$transaction(async (tx) => {
      await lockWallet(tx, input.clientSiteId)
      const previous = await tx.articleCreditGrant.findUnique({ where: { idempotencyKey: `admin:${input.key}` } })
      if (previous) return previous
      const operation = await tx.articleCreditOperation.findFirst({
        where: { id: input.operationId, clientSiteId: input.clientSiteId, status: 'COMPLETED', charged: 1 },
      })
      if (!operation) throw createError({ statusCode: 400, message: 'Refundable article operation not found' })
      const refunded = await tx.articleCreditLedgerEntry.findFirst({
        where: { clientSiteId: input.clientSiteId, operationId: operation.id, kind: 'REFUND' },
      })
      if (refunded) throw createError({ statusCode: 409, message: 'Article operation already refunded' })
      return creditArticleCredits(
        {
          clientSiteId: input.clientSiteId,
          amount: 1,
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
  if (input.kind !== 'DEBIT')
    return creditArticleCredits({
      clientSiteId: input.clientSiteId,
      amount: input.amount,
      source: input.kind === 'BONUS' ? 'BONUS' : 'ADMIN',
      idempotencyKey: `admin:${input.key}`,
      reason: input.reason,
      expiresAt: input.kind === 'BONUS' ? new Date(Date.now() + 30 * 24 * 60 * 60_000) : null,
      ledgerKind: input.kind,
    })

  return prisma.$transaction(async (tx) => {
    const wallet = await lockWallet(tx, input.clientSiteId)
    await expireAvailableGrants(tx, input.clientSiteId)
    const previous = await tx.articleCreditLedgerEntry.findUnique({ where: { idempotencyKey: `admin:${input.key}` } })
    if (previous) return previous
    const current = await tx.articleCreditWallet.findUniqueOrThrow({ where: { id: wallet.id } })
    if (current.balance - current.reserved < input.amount)
      throw createError({ statusCode: 409, message: 'Adjustment exceeds available articles' })

    let remaining = input.amount
    const grants = await tx.articleCreditGrant.findMany({
      where: { clientSiteId: input.clientSiteId, remaining: { gt: 0 } },
      orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }, { id: 'asc' }],
    })
    for (const grant of grants) {
      if (!remaining) break
      const used = Math.min(grant.remaining, remaining)
      await tx.articleCreditGrant.update({ where: { id: grant.id }, data: { remaining: { decrement: used } } })
      remaining -= used
    }
    await tx.articleCreditWallet.update({
      where: { id: input.clientSiteId },
      data: { balance: { decrement: input.amount } },
    })
    return tx.articleCreditLedgerEntry.create({
      data: {
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
  action: 'MANUAL_ARTICLE' | 'SCHEDULED_ARTICLE',
  key: string = randomUUID(),
  metadata: JsonValue = {},
) {
  return prisma.$transaction(async (tx) => {
    const wallet = await lockWallet(tx, clientSiteId)
    await releaseExpiredOperations(tx, clientSiteId)
    await expireAvailableGrants(tx, clientSiteId)
    const previous = await tx.articleCreditOperation.findUnique({ where: { idempotencyKey: key } })
    if (previous) throw createError({ statusCode: 409, message: 'Operation already submitted' })

    const current = await tx.articleCreditWallet.findUniqueOrThrow({ where: { id: wallet.id } })
    const available = current.balance - current.reserved
    if (available < 1)
      throw createError({
        statusCode: 402,
        message: 'No articles remaining',
        data: { required: 1, available },
      })

    const grant = await tx.articleCreditGrant.findFirstOrThrow({
      where: {
        clientSiteId,
        remaining: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }, { id: 'asc' }],
    })
    const allocations: Allocation = [{ id: grant.id, amount: 1 }]
    await tx.articleCreditGrant.update({ where: { id: grant.id }, data: { remaining: { decrement: 1 } } })
    const operation = await tx.articleCreditOperation.create({
      data: {
        clientSiteId,
        action,
        allocations,
        metadata,
        idempotencyKey: key,
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    })
    await tx.articleCreditWallet.update({ where: { id: clientSiteId }, data: { reserved: { increment: 1 } } })
    return operation
  })
}

export async function settleArticleCredit(
  operation: Pick<ArticleCreditOperation, 'id' | 'clientSiteId'>,
  charge: boolean,
  metadata: JsonValue = {},
) {
  return prisma.$transaction(async (tx) => {
    await lockWallet(tx, operation.clientSiteId)
    const current = await tx.articleCreditOperation.findFirstOrThrow({
      where: { id: operation.id, clientSiteId: operation.clientSiteId },
    })
    if (current.status !== 'RESERVED') return getArticleCreditWallet(operation.clientSiteId, tx)

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
        charged: charge ? 1 : 0,
        metadata,
        completedAt: new Date(),
      },
    })
    await tx.articleCreditWallet.update({
      where: { id: operation.clientSiteId },
      data: {
        reserved: { decrement: 1 },
        ...(charge ? { balance: { decrement: 1 } } : {}),
      },
    })
    await tx.articleCreditLedgerEntry.create({
      data: {
        clientSiteId: operation.clientSiteId,
        operationId: current.id,
        kind: charge ? 'DEBIT' : 'RELEASE',
        amount: charge ? -1 : 0,
        reason: current.action,
        idempotencyKey: `settle:${current.id}`,
      },
    })
    return getArticleCreditWallet(operation.clientSiteId, tx)
  })
}

export async function getArticleCreditWallet(clientSiteId: string, transaction?: Tx) {
  const read = async (tx: Tx) => {
    await lockWallet(tx, clientSiteId)
    await releaseExpiredOperations(tx, clientSiteId)
    await expireAvailableGrants(tx, clientSiteId)
    const wallet = await tx.articleCreditWallet.findUniqueOrThrow({ where: { id: clientSiteId } })
    const grants = await tx.articleCreditGrant.findMany({
      where: { clientSiteId, remaining: { gt: 0 } },
      orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      select: { id: true, source: true, remaining: true, expiresAt: true, periodEnd: true },
    })
    return { ...wallet, available: wallet.balance - wallet.reserved, grants }
  }
  return transaction ? read(transaction) : prisma.$transaction(read)
}

export async function withArticleCreditReservation<T>(
  clientSiteId: string,
  action: 'MANUAL_ARTICLE' | 'SCHEDULED_ARTICLE',
  work: (operation: ArticleCreditOperation) => Promise<T>,
  options: {
    key?: string
    metadata?: JsonValue
    shouldCharge?: (result: T) => boolean
  } = {},
) {
  const operation = await reserveArticleCredit(clientSiteId, action, options.key, options.metadata)
  try {
    const result = await work(operation)
    await settleArticleCredit(operation, options.shouldCharge ? options.shouldCharge(result) : true, options.metadata)
    return result
  } catch (error) {
    await settleArticleCredit(operation, false, { error: error instanceof Error ? error.message : String(error) })
    throw error
  }
}

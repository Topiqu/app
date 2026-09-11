import type { H3Event } from 'h3'
import type { Prisma, TokenOperation } from '@prisma/client'

import { randomUUID } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'

import type appPrisma from './prisma'

import { TOKEN_RATIO } from './tokenRatio'
import { TOKEN_PRICE_VERSION, validateCreditAmount, walletSettlement } from '../../shared/utils/tokenWallet'

type Tx = Parameters<Parameters<typeof appPrisma.$transaction>[0]>[0]
type Allocation = { id: string; amount: number }[]
const walletContext = new AsyncLocalStorage<{
  clientSiteId: string
  operationId: string
  budget: number
  ratio: number
  actual: number
  metadata: Prisma.InputJsonValue
}>()
export const currentTokenOperation = () => walletContext.getStore()
export async function commitTokenUsage() {
  const usage = walletContext.getStore()
  if (!usage) throw new Error('No active reservation')
  return settleTokens(usage.clientSiteId, usage.operationId, usage.actual, usage.metadata)
}
export function tokenRequestKey(event: H3Event, clientSiteId: string, action: string) {
  const key = getHeader(event, 'idempotency-key') ?? randomUUID()
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(key)) throw createError({ statusCode: 400, message: 'Invalid idempotency key' })
  return `${clientSiteId}:${action}:${key}`
}

/** Reserve before calling a provider. Failed work releases credit; settlement is explicit inside work. */
export async function withTokenReservation<T>(
  clientSiteId: string,
  budget: number,
  action: string,
  work: () => Promise<T>,
  key?: string,
): Promise<T> {
  const operation = await reserveTokens(clientSiteId, budget, action, key)
  return runReservedTokens(operation, work)
}

/** Used by streaming endpoints after HTTP preflight has already reserved credit. */
export async function runReservedTokens<T>(operation: TokenOperation, work: () => Promise<T>): Promise<T> {
  const clientSiteId = operation.clientSiteId
  const budget = operation.reserved
  const ratio = Number((operation.metadata as Record<string, unknown>).ratio ?? TOKEN_RATIO)
  return walletContext.run(
    { clientSiteId, operationId: operation.id, budget, ratio, actual: 0, metadata: {} },
    async () => {
      try {
        const result = await work()
        const usage = walletContext.getStore()!
        const failed = result && typeof result === 'object' && 'status' in result && result.status === 'failed'
        await settleTokens(
          clientSiteId,
          operation.id,
          failed ? 0 : usage.actual,
          usage.metadata,
          failed ? 'RELEASED' : 'COMPLETED',
        )
        return result
      } catch (error) {
        await settleTokens(clientSiteId, operation.id, 0, {}, 'RELEASED')
        throw error
      }
    },
  )
}

/** Stage usage; only commit when the enclosing workflow has produced its result. */
export async function recordTokenUsage(clientSiteId: string, actual: number, metadata: Prisma.InputJsonValue) {
  const context = walletContext.getStore()
  if (!context || context.clientSiteId !== clientSiteId) throw new Error('Token usage requires a reservation')
  if (!Number.isSafeInteger(actual) || actual < 0) throw new Error('Invalid usage')
  context.actual = actual
  context.metadata = metadata
  const wallet = await prisma.tokenWallet.findUniqueOrThrow({ where: { id: clientSiteId } })
  const charged = Math.min(context.budget, actual)
  return { charged, available: wallet.balance - wallet.reserved + context.budget - charged }
}

// Lock the tenant first, including first use of a newly created wallet. All wallet writes use this order.
async function lockWallet(tx: Tx, clientSiteId: string) {
  const sites = await tx.$queryRaw<{ id: string; tokenRemaining: number | null }[]>`
    SELECT "id", "tokenRemaining" FROM "ClientSite" WHERE "id" = ${clientSiteId} FOR UPDATE`
  const site = sites[0]
  if (!site) throw createError({ statusCode: 404, message: 'Wallet owner not found' })
  let wallet = await tx.tokenWallet.findUnique({ where: { id: clientSiteId } })
  if (!wallet) {
    const balance = Math.max(0, site.tokenRemaining ?? 0)
    wallet = await tx.tokenWallet.create({ data: { id: clientSiteId, balance } })
    if (balance) {
      const key = `opening:${clientSiteId}`
      const grant = await tx.tokenCreditGrant.create({
        data: {
          clientSiteId,
          source: 'MIGRATION',
          amount: balance,
          remaining: balance,
          idempotencyKey: key,
        },
      })
      await tx.tokenLedgerEntry.create({
        data: {
          clientSiteId,
          kind: 'CREDIT',
          amount: balance,
          grantId: grant.id,
          reason: 'Opening balance',
          idempotencyKey: key,
        },
      })
    }
  }
  await expireCredit(tx, clientSiteId)
  return tx.tokenWallet.findUniqueOrThrow({ where: { id: clientSiteId } })
}

async function expireCredit(tx: Tx, clientSiteId: string) {
  const grants = await tx.tokenCreditGrant.findMany({
    where: { clientSiteId, expiresAt: { lte: new Date() }, remaining: { gt: 0 } },
  })
  for (const grant of grants) {
    await tx.tokenCreditGrant.update({ where: { id: grant.id }, data: { remaining: 0 } })
    await tx.tokenWallet.update({ where: { id: clientSiteId }, data: { balance: { decrement: grant.remaining } } })
    await tx.tokenLedgerEntry.create({
      data: {
        clientSiteId,
        kind: 'EXPIRY',
        amount: -grant.remaining,
        grantId: grant.id,
        reason: 'Promotional credit expired',
        idempotencyKey: `expire:${grant.id}:${randomUUID()}`,
      },
    })
  }
}

async function syncBalance(tx: Tx, clientSiteId: string) {
  await expireCredit(tx, clientSiteId)
  const wallet = await tx.tokenWallet.findUniqueOrThrow({ where: { id: clientSiteId } })
  // Temporary compatibility projection for existing generation preflight checks.
  await tx.clientSite.update({
    where: { id: clientSiteId },
    data: { tokenRemaining: wallet.balance - wallet.reserved },
  })
  return wallet.balance - wallet.reserved
}

export async function creditTokens(
  input: {
    clientSiteId: string
    amount: number
    source: string
    idempotencyKey: string
    reason: string
    actorId?: string
    expiresAt?: Date
  },
  transaction?: Tx,
) {
  validateCreditAmount(input.amount)
  if (!input.reason.trim()) throw new Error('A credit reason is required')
  const write = async (tx: Tx) => {
    await lockWallet(tx, input.clientSiteId)
    const previous = await tx.tokenCreditGrant.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
    if (previous) {
      if (
        previous.clientSiteId !== input.clientSiteId ||
        previous.amount !== input.amount ||
        previous.source !== input.source
      )
        throw createError({ statusCode: 409, message: 'Credit key already used' })
      return previous
    }
    if (
      input.expiresAt &&
      (['PURCHASE', 'MIGRATION', 'REFUND'].includes(input.source) || input.expiresAt <= new Date())
    )
      throw createError({ statusCode: 400, message: 'Invalid credit expiry' })
    const grant = await tx.tokenCreditGrant.create({
      data: {
        clientSiteId: input.clientSiteId,
        source: input.source,
        amount: input.amount,
        remaining: input.amount,
        expiresAt: input.expiresAt,
        idempotencyKey: input.idempotencyKey,
      },
    })
    await tx.tokenWallet.update({ where: { id: input.clientSiteId }, data: { balance: { increment: input.amount } } })
    await tx.tokenLedgerEntry.create({
      data: {
        clientSiteId: input.clientSiteId,
        kind: 'CREDIT',
        amount: input.amount,
        grantId: grant.id,
        actorId: input.actorId,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
      },
    })
    await syncBalance(tx, input.clientSiteId)
    return grant
  }
  return transaction ? write(transaction) : prisma.$transaction(write)
}

export async function reserveTokens(
  clientSiteId: string,
  amount: number,
  action: string,
  key: string = randomUUID(),
  transaction?: Tx,
) {
  validateCreditAmount(amount)
  const write = async (tx: Tx) => {
    const wallet = await lockWallet(tx, clientSiteId)
    const previous = await tx.tokenOperation.findUnique({ where: { idempotencyKey: key } })
    if (previous) throw createError({ statusCode: 409, message: 'Operation already submitted' })
    if (wallet.balance - wallet.reserved < amount)
      throw createError({
        statusCode: 402,
        message: 'Insufficient credit',
        data: { required: amount, available: wallet.balance - wallet.reserved },
      })
    const grants = await tx.tokenCreditGrant.findMany({
      where: { clientSiteId, remaining: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }, { id: 'asc' }],
    })
    let needed = amount
    const allocations: Allocation = []
    for (const grant of grants) {
      const take = Math.min(needed, grant.remaining)
      if (!take) break
      allocations.push({ id: grant.id, amount: take })
      await tx.tokenCreditGrant.update({ where: { id: grant.id }, data: { remaining: { decrement: take } } })
      needed -= take
    }
    if (needed) throw createError({ statusCode: 402, message: 'Available credit has expired' })
    const operation = await tx.tokenOperation.create({
      data: {
        clientSiteId,
        action,
        reserved: amount,
        allocations,
        metadata: { ratio: TOKEN_RATIO },
        priceVersion: `${TOKEN_PRICE_VERSION}:ratio:${TOKEN_RATIO}`,
        idempotencyKey: key,
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    })
    await tx.tokenWallet.update({ where: { id: clientSiteId }, data: { reserved: { increment: amount } } })
    await syncBalance(tx, clientSiteId)
    return operation
  }
  return transaction ? write(transaction) : prisma.$transaction(write)
}

export async function getTokenWallet(clientSiteId: string) {
  return prisma.$transaction(async (tx) => {
    await lockWallet(tx, clientSiteId)
    const available = await syncBalance(tx, clientSiteId)
    const wallet = await tx.tokenWallet.findUniqueOrThrow({ where: { id: clientSiteId } })
    const now = new Date()
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const usage = await tx.tokenLedgerEntry.aggregate({
      where: { clientSiteId, kind: 'DEBIT', createdAt: { gte: periodStart } },
      _sum: { amount: true },
    })
    const expiring = await tx.tokenCreditGrant.findMany({
      where: { clientSiteId, remaining: { gt: 0 }, expiresAt: { not: null } },
      orderBy: { expiresAt: 'asc' },
      select: { remaining: true, expiresAt: true, source: true },
    })
    return {
      available,
      reserved: wallet.reserved,
      balance: wallet.balance,
      periodUsage: Math.abs(usage._sum.amount ?? 0),
      periodStart,
      expiring,
      priceVersion: TOKEN_PRICE_VERSION,
    }
  })
}

export async function recoverTokenReservations() {
  const expired = await prisma.tokenOperation.findMany({
    where: { status: 'RESERVED', expiresAt: { lte: new Date() } },
    take: 100,
    orderBy: { expiresAt: 'asc' },
  })
  for (const operation of expired)
    await settleTokens(operation.clientSiteId, operation.id, 0, { reason: 'Reservation timed out' }, 'RELEASED')
  const grants = await prisma.tokenCreditGrant.findMany({
    where: { expiresAt: { lte: new Date() }, remaining: { gt: 0 } },
    distinct: ['clientSiteId'],
    take: 100,
    select: { clientSiteId: true },
  })
  for (const grant of grants) await getTokenWallet(grant.clientSiteId)
  return expired.length
}

export async function settleTokens(
  clientSiteId: string,
  operationId: string,
  actual: number,
  metadata: Prisma.InputJsonValue = {},
  status = 'COMPLETED',
  transaction?: Tx,
) {
  const write = async (tx: Tx) => {
    await lockWallet(tx, clientSiteId)
    const operation = await tx.tokenOperation.findFirstOrThrow({ where: { id: operationId, clientSiteId } })
    if (operation.status !== 'RESERVED')
      return { charged: operation.charged, available: await syncBalance(tx, clientSiteId) }
    const settlement = walletSettlement(operation.reserved, actual)
    let charge = settlement.charged
    for (const allocation of operation.allocations as Allocation) {
      const spent = Math.min(charge, allocation.amount)
      charge -= spent
      await tx.tokenCreditGrant.update({
        where: { id: allocation.id },
        data: { remaining: { increment: allocation.amount - spent } },
      })
    }
    await tx.tokenOperation.update({
      where: { id: operationId },
      data: {
        status,
        actual,
        charged: settlement.charged,
        metadata,
        completedAt: new Date(),
      },
    })
    await tx.tokenWallet.update({
      where: { id: clientSiteId },
      data: {
        balance: { decrement: settlement.charged },
        reserved: { decrement: operation.reserved },
      },
    })
    await tx.tokenLedgerEntry.create({
      data: {
        clientSiteId,
        kind: operation.action === 'ADMIN_DEBIT' ? 'ADJUSTMENT' : settlement.charged ? 'DEBIT' : 'RELEASE',
        amount: -settlement.charged,
        operationId,
        reason:
          operation.action === 'ADMIN_DEBIT' ? String((metadata as Record<string, unknown>).reason) : operation.action,
        actorId: operation.action === 'ADMIN_DEBIT' ? String((metadata as Record<string, unknown>).actorId) : undefined,
        idempotencyKey: operation.action === 'ADMIN_DEBIT' ? operation.idempotencyKey : `settle:${operationId}`,
      },
    })
    if (operation.action !== 'ADMIN_DEBIT')
      await tx.clientSite.update({
        where: { id: clientSiteId },
        data: { totalUsage: { increment: settlement.charged } },
      })
    return { charged: settlement.charged, available: await syncBalance(tx, clientSiteId) }
  }
  return transaction ? write(transaction) : prisma.$transaction(write)
}

export async function adjustTokenWallet(input: {
  clientSiteId: string
  amount: number
  kind: 'CREDIT' | 'BONUS' | 'DEBIT' | 'REFUND'
  reason: string
  actorId: string
  key: string
  operationId?: string
}) {
  validateCreditAmount(input.amount)
  return prisma.$transaction(async (tx) => {
    await lockWallet(tx, input.clientSiteId)
    const key = `admin:${input.clientSiteId}:${input.key}`
    const existing = await tx.tokenLedgerEntry.findUnique({ where: { idempotencyKey: key } })
    const signedAmount = input.kind === 'DEBIT' ? -input.amount : input.amount
    if (existing) {
      if (
        existing.amount !== signedAmount ||
        existing.reason !== input.reason ||
        existing.kind !== (input.kind === 'DEBIT' ? 'ADJUSTMENT' : input.kind)
      )
        throw createError({ statusCode: 409, message: 'Adjustment key already used' })
      return existing
    }
    if (input.kind === 'DEBIT') {
      const operation = await reserveTokens(input.clientSiteId, input.amount, 'ADMIN_DEBIT', key, tx)
      await settleTokens(
        input.clientSiteId,
        operation.id,
        input.amount,
        { actorId: input.actorId, reason: input.reason },
        'COMPLETED',
        tx,
      )
      return tx.tokenLedgerEntry.findUniqueOrThrow({ where: { idempotencyKey: key } })
    }
    if (input.kind === 'REFUND') {
      const operation = await tx.tokenOperation.findFirst({
        where: { id: input.operationId ?? '', clientSiteId: input.clientSiteId, status: 'COMPLETED' },
      })
      if (!operation) throw createError({ statusCode: 400, message: 'Original completed operation required' })
      const refunded = await tx.tokenLedgerEntry.aggregate({
        where: { clientSiteId: input.clientSiteId, operationId: operation.id, kind: 'REFUND' },
        _sum: { amount: true },
      })
      if (input.amount + (refunded._sum.amount ?? 0) > operation.charged)
        throw createError({ statusCode: 400, message: 'Refund exceeds original charge' })
    }
    // Credit and its audit row are written together, including a link for refund caps.
    const grant = await tx.tokenCreditGrant.create({
      data: {
        clientSiteId: input.clientSiteId,
        source: input.kind === 'CREDIT' ? 'ADMIN' : input.kind,
        expiresAt: input.kind === 'BONUS' ? new Date(Date.now() + 30 * 86400000) : undefined,
        amount: input.amount,
        remaining: input.amount,
        idempotencyKey: key,
      },
    })
    await tx.tokenWallet.update({ where: { id: input.clientSiteId }, data: { balance: { increment: input.amount } } })
    const entry = await tx.tokenLedgerEntry.create({
      data: {
        clientSiteId: input.clientSiteId,
        kind: input.kind,
        amount: input.amount,
        actorId: input.actorId,
        reason: input.reason,
        operationId: input.kind === 'REFUND' ? input.operationId : undefined,
        grantId: grant.id,
        idempotencyKey: key,
      },
    })
    await syncBalance(tx, input.clientSiteId)
    return entry
  })
}

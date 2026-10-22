// @vitest-environment node
import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  adjustArticleCredits,
  getArticleCreditWallet,
  reserveArticleCredit,
  settleArticleCredit,
  withArticleCreditReservation,
} from '../../server/utils/articleCreditWallet'

type Grant = {
  id: string
  clientSiteId: string
  remaining: number
  expiresAt: Date | null
  amount: number
  source: string
  idempotencyKey: string
}
type Operation = {
  id: string
  clientSiteId: string
  reserved: number
  charged: number
  status: string
  expiresAt: Date
  allocations: { id: string; amount: number }[]
  metadata: Record<string, unknown>
  idempotencyKey: string
}

// Stateful delegates exercise the real reservation/settlement code without requiring a live DB.
const setup = (amounts = [1, 4]) => {
  const state = {
    wallet: { id: 'site', balance: amounts.reduce((sum, value) => sum + value, 0), reserved: 0 },
    grants: amounts.map((amount, index): Grant => ({
      id: `grant-${index}`,
      clientSiteId: 'site',
      remaining: amount,
      amount,
      source: index ? 'PURCHASE' : 'PLAN',
      expiresAt: index ? null : new Date(Date.now() + 60_000),
      idempotencyKey: `grant-${index}`,
    })),
    operations: [] as Operation[],
    entries: [] as Record<string, any>[],
  }
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: 'site' }]),
    articleCreditWallet: {
      upsert: vi.fn(async () => ({ ...state.wallet })),
      findUniqueOrThrow: vi.fn(async () => ({ ...state.wallet })),
      update: vi.fn(async ({ data }) => {
        for (const field of ['balance', 'reserved'] as const) {
          state.wallet[field] += data[field]?.increment ?? 0
          state.wallet[field] -= data[field]?.decrement ?? 0
        }
        return { ...state.wallet }
      }),
    },
    articleCreditGrant: {
      findMany: vi.fn(async ({ where }) =>
        state.grants
          .filter(
            (grant) =>
              grant.remaining > 0 &&
              (!where.expiresAt?.lte || (grant.expiresAt != null && grant.expiresAt <= where.expiresAt.lte)),
          )
          .map((grant) => ({ ...grant })),
      ),
      findUnique: vi.fn(
        async ({ where }) => state.grants.find((grant) => grant.idempotencyKey === where.idempotencyKey) ?? null,
      ),
      update: vi.fn(async ({ where, data }) => {
        const grant = state.grants.find((value) => value.id === where.id)!
        grant.remaining =
          typeof data.remaining === 'number'
            ? data.remaining
            : grant.remaining + (data.remaining.increment ?? 0) - (data.remaining.decrement ?? 0)
        return { ...grant }
      }),
      create: vi.fn(async ({ data }) => {
        const grant = { ...data, id: `grant-${state.grants.length}`, expiresAt: data.expiresAt ?? null }
        state.grants.push(grant)
        return grant
      }),
    },
    articleCreditOperation: {
      findMany: vi.fn(async ({ where }) =>
        state.operations.filter(
          (operation) => operation.status === where.status && operation.expiresAt <= where.expiresAt.lte,
        ),
      ),
      findUnique: vi.fn(
        async ({ where }) =>
          state.operations.find((operation) => operation.idempotencyKey === where.idempotencyKey) ?? null,
      ),
      findFirstOrThrow: vi.fn(async ({ where }) => ({
        ...state.operations.find((operation) => operation.id === where.id)!,
      })),
      findFirst: vi.fn(
        async ({ where }) =>
          state.operations.find(
            (operation) =>
              operation.id === where.id &&
              operation.clientSiteId === where.clientSiteId &&
              operation.status === where.status &&
              operation.charged > 0,
          ) ?? null,
      ),
      create: vi.fn(async ({ data }) => {
        const operation = { ...data, id: `op-${state.operations.length}`, status: 'RESERVED', charged: 0 }
        state.operations.push(operation)
        return { ...operation }
      }),
      update: vi.fn(async ({ where, data }) =>
        Object.assign(
          state.operations.find((operation) => operation.id === where.id)!,
          data,
        ),
      ),
    },
    articleCreditLedgerEntry: {
      create: vi.fn(async ({ data }) => {
        state.entries.push(data)
        return data
      }),
      findFirst: vi.fn(
        async ({ where }) =>
          state.entries.find((entry) => entry.operationId === where.operationId && entry.kind === where.kind) ?? null,
      ),
    },
  }
  vi.stubGlobal('prisma', { $transaction: async (run: (value: typeof tx) => unknown) => run(tx) })
  return { state, tx }
}

beforeEach(() => vi.stubGlobal('createError', createError))
afterEach(() => vi.unstubAllGlobals())

describe('quality-priced article credits', () => {
  it('reserves three credits across grants and charges the frozen price exactly once', async () => {
    const { state } = setup()
    const operation = await reserveArticleCredit('site', 'MANUAL_ARTICLE', 'ultra', { articleQuality: 'ULTRA' }, 3)
    expect(operation).toMatchObject({
      reserved: 3,
      allocations: [
        { id: 'grant-0', amount: 1 },
        { id: 'grant-1', amount: 2 },
      ],
    })
    expect(state.wallet).toMatchObject({ balance: 5, reserved: 3 })
    expect(state.grants.map((grant) => grant.remaining)).toEqual([0, 2])
    expect(await settleArticleCredit(operation, true, { title: 'Finished' })).toMatchObject({
      balance: 2,
      reserved: 0,
      available: 2,
    })
    await settleArticleCredit(operation, true)
    expect(state.operations[0]).toMatchObject({ charged: 3, metadata: { articleQuality: 'ULTRA', title: 'Finished' } })
    expect(state.entries.filter((entry) => entry.kind === 'DEBIT')).toEqual([expect.objectContaining({ amount: -3 })])
  })

  it('rejects an unaffordable tier before touching grants or starting work', async () => {
    const { state, tx } = setup([2])
    const work = vi.fn()
    await expect(withArticleCreditReservation('site', 'SCHEDULED_ARTICLE', work, { amount: 3 })).rejects.toMatchObject({
      statusCode: 402,
      data: { required: 3, available: 2 },
    })
    expect(work).not.toHaveBeenCalled()
    expect(tx.articleCreditGrant.update).not.toHaveBeenCalled()
    expect(state.wallet).toMatchObject({ balance: 2, reserved: 0 })
  })

  it('returns the entire reservation and original allocations after a provider failure', async () => {
    const { state } = setup()
    await expect(
      withArticleCreditReservation(
        'site',
        'SCHEDULED_ARTICLE',
        async () => {
          throw new Error('writer failed')
        },
        { amount: 3, metadata: { articleQuality: 'ULTRA' } },
      ),
    ).rejects.toThrow('writer failed')
    expect(await getArticleCreditWallet('site')).toMatchObject({ balance: 5, reserved: 0, available: 5 })
    expect(state.grants.map((grant) => grant.remaining)).toEqual([1, 4])
    expect(state.operations[0]).toMatchObject({
      status: 'RELEASED',
      charged: 0,
      metadata: { articleQuality: 'ULTRA', error: 'writer failed' },
    })
    expect(state.entries.some((entry) => entry.kind === 'DEBIT')).toBe(false)
  })

  it('releases all three credits when a reservation expires', async () => {
    const { state } = setup()
    await reserveArticleCredit('site', 'MANUAL_ARTICLE', 'expired', {}, 3)
    state.operations[0]!.expiresAt = new Date(0)
    expect(await getArticleCreditWallet('site')).toMatchObject({ balance: 5, reserved: 0, available: 5 })
    expect(state.operations[0]?.status).toBe('EXPIRED')
    expect(state.grants.map((grant) => grant.remaining)).toEqual([1, 4])
  })

  it('expires returned allocations even if their grant expired while they were held', async () => {
    const { state } = setup([5])
    const operation = await reserveArticleCredit('site', 'MANUAL_ARTICLE', 'expires', {}, 3)
    state.grants[0]!.expiresAt = new Date(0)
    expect(await getArticleCreditWallet('site')).toMatchObject({ balance: 3, reserved: 3, available: 0 })
    expect(await settleArticleCredit(operation, false)).toMatchObject({ balance: 0, reserved: 0, available: 0 })
    expect(state.entries.filter((entry) => entry.kind === 'EXPIRE').map((entry) => entry.amount)).toEqual([-2, -3])
    expect(new Set(state.entries.map((entry) => entry.idempotencyKey)).size).toBe(state.entries.length)
  })

  it('refunds the original three-credit charge once and rejects partial or repeated refunds', async () => {
    const { state } = setup()
    const operation = await reserveArticleCredit('site', 'MANUAL_ARTICLE', 'refund', {}, 3)
    await settleArticleCredit(operation, true)
    const input = {
      clientSiteId: 'site',
      amount: 3,
      kind: 'REFUND' as const,
      reason: 'Customer support',
      operationId: operation.id,
      key: 'refund-1',
    }
    await expect(adjustArticleCredits({ ...input, amount: 1 })).rejects.toMatchObject({ statusCode: 400 })
    await adjustArticleCredits(input)
    await adjustArticleCredits(input)
    expect(state.wallet.balance).toBe(5)
    expect(state.entries.filter((entry) => entry.kind === 'REFUND')).toEqual([
      expect.objectContaining({ amount: 3, operationId: operation.id }),
    ])
    await expect(adjustArticleCredits({ ...input, key: 'refund-2' })).rejects.toMatchObject({ statusCode: 409 })
  })

  it('keeps content refreshes at their existing one-credit price', async () => {
    const { state } = setup()
    await withArticleCreditReservation('site', 'CONTENT_REFRESH', async () => 'updated')
    expect(state.operations[0]).toMatchObject({ reserved: 1, charged: 1 })
    expect(state.wallet.balance).toBe(4)
  })

  it.each([0, -1, 1.5, Number.NaN])('rejects an invalid reservation amount %s', async (amount) => {
    const { tx } = setup()
    await expect(reserveArticleCredit('site', 'MANUAL_ARTICLE', 'invalid', {}, amount)).rejects.toThrow(
      'positive integer',
    )
    expect(tx.$queryRaw).not.toHaveBeenCalled()
  })
})

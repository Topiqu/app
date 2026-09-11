// @vitest-environment node
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'

import {
  creditTokens,
  reserveTokens,
  settleTokens,
  getTokenWallet,
  withTokenReservation,
  recordTokenUsage,
  adjustTokenWallet,
  recoverTokenReservations,
} from '../../server/utils/tokenWallet'

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? new PrismaClient({ datasourceUrl: url }) : null
describe.skipIf(!enabled)('wallet on PostgreSQL', () => {
  beforeAll(() => {
    vi.stubGlobal('prisma', db)
    vi.stubGlobal('createError', createError)
  })
  afterAll(async () => {
    await db?.$disconnect()
    vi.unstubAllGlobals()
  })
  async function tenant(balance = 1000) {
    const id = randomUUID()
    await db!.clientSite.create({
      data: { id, name: `wallet-test-${id}`, domain: `${id}.test`, tokenRemaining: balance },
    })
    return id
  }
  it('preserves the opening balance and credits a replayed purchase only once', async () => {
    const id = await tenant()
    const input = {
      clientSiteId: id,
      amount: 500,
      source: 'PURCHASE',
      reason: 'test',
      idempotencyKey: `checkout:${randomUUID()}`,
    }
    await Promise.all([creditTokens(input), creditTokens(input)])
    expect(await getTokenWallet(id)).toMatchObject({ available: 1500, reserved: 0, periodUsage: 0 })
    expect(await db!.tokenCreditGrant.count({ where: { clientSiteId: id } })).toBe(2)
  })
  it('serializes concurrent reservations and rejects overspending before work starts', async () => {
    const id = await tenant()
    const results = await Promise.allSettled([reserveTokens(id, 700, 'test'), reserveTokens(id, 700, 'test')])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await getTokenWallet(id)).toMatchObject({ available: 300, reserved: 700 })
    const work = vi.fn()
    await expect(withTokenReservation(id, 500, 'test', work)).rejects.toMatchObject({ statusCode: 402 })
    expect(work).not.toHaveBeenCalled()
  })
  it('caps provider overruns and makes repeated settlement harmless', async () => {
    const id = await tenant()
    const op = await reserveTokens(id, 400, 'test')
    await settleTokens(id, op.id, 900, { rawUsage: { totalTokens: 900 } })
    await settleTokens(id, op.id, 900)
    expect(await getTokenWallet(id)).toMatchObject({ balance: 600, reserved: 0, periodUsage: 400 })
    expect(await db!.tokenOperation.findUnique({ where: { id: op.id } })).toMatchObject({ actual: 900, charged: 400 })
  })
  it('releases a failed workflow even after usage was recorded', async () => {
    const id = await tenant()
    await expect(
      withTokenReservation(id, 500, 'test', async () => {
        await recordTokenUsage(id, 300, {})
        throw new Error('storage failed')
      }),
    ).rejects.toThrow('storage failed')
    expect(await getTokenWallet(id)).toMatchObject({ available: 1000, reserved: 0, periodUsage: 0 })
  })
  it('charges only actual partial work on normal completion / Stop', async () => {
    const id = await tenant()
    await withTokenReservation(id, 500, 'STOP', async () => {
      await recordTokenUsage(id, 123, {})
    })
    expect(await getTokenWallet(id)).toMatchObject({ available: 877, reserved: 0, periodUsage: 123 })
  })
  it('spends expiring credit first and never expires purchased credit', async () => {
    const id = await tenant(0)
    await creditTokens({
      clientSiteId: id,
      amount: 500,
      source: 'PURCHASE',
      reason: 'test',
      idempotencyKey: randomUUID(),
    })
    const promo = await creditTokens({
      clientSiteId: id,
      amount: 200,
      source: 'TRIAL',
      expiresAt: new Date(Date.now() + 60000),
      reason: 'trial',
      idempotencyKey: randomUUID(),
    })
    const op = await reserveTokens(id, 300, 'test')
    await settleTokens(id, op.id, 100)
    expect(await db!.tokenCreditGrant.findUnique({ where: { id: promo.id } })).toMatchObject({ remaining: 100 })
    await db!.tokenCreditGrant.update({ where: { id: promo.id }, data: { expiresAt: new Date(0) } })
    expect(await getTokenWallet(id)).toMatchObject({ available: 500 })
  })
  it('recovers orphans without charging and expires released promotional allocations', async () => {
    const id = await tenant(0)
    const promo = await creditTokens({
      clientSiteId: id,
      amount: 300,
      source: 'TRIAL',
      expiresAt: new Date(Date.now() + 60000),
      reason: 'trial',
      idempotencyKey: randomUUID(),
    })
    const op = await reserveTokens(id, 300, 'test')
    await db!.tokenCreditGrant.update({ where: { id: promo.id }, data: { expiresAt: new Date(0) } })
    await db!.tokenOperation.update({ where: { id: op.id }, data: { expiresAt: new Date(0) } })
    await recoverTokenReservations()
    expect(await getTokenWallet(id)).toMatchObject({ available: 0, reserved: 0 })
  })
  it('audits idempotent adjustments and prevents over-refunds and cross-tenant settlement', async () => {
    const id = await tenant()
    const input = {
      clientSiteId: id,
      amount: 200,
      kind: 'DEBIT' as const,
      reason: 'correction',
      actorId: randomUUID(),
      key: randomUUID(),
    }
    await adjustTokenWallet(input)
    await adjustTokenWallet(input)
    expect(await getTokenWallet(id)).toMatchObject({ available: 800, periodUsage: 0 })
    const op = await reserveTokens(id, 200, 'test')
    await settleTokens(id, op.id, 150)
    const refund = { ...input, kind: 'REFUND' as const, amount: 100, operationId: op.id, key: randomUUID() }
    await adjustTokenWallet(refund)
    await adjustTokenWallet(refund)
    await expect(adjustTokenWallet({ ...refund, key: randomUUID() })).rejects.toMatchObject({ statusCode: 400 })
    await expect(settleTokens(await tenant(), op.id, 0)).rejects.toThrow()
    expect(await getTokenWallet(id)).toMatchObject({ available: 750 })
  })
  it('rejects legacy direct writes to the balance projection', async () => {
    const id = await tenant()
    await getTokenWallet(id)
    await expect(db!.clientSite.update({ where: { id }, data: { tokenRemaining: 9999 } })).rejects.toThrow('projection')
    expect(await getTokenWallet(id)).toMatchObject({ available: 1000 })
  })
  it('rejects ledger mutation at the database level', async () => {
    const id = await tenant()
    await getTokenWallet(id)
    await expect(db!.tokenLedgerEntry.updateMany({ where: { clientSiteId: id }, data: { amount: 1 } })).rejects.toThrow(
      'immutable',
    )
  })
})

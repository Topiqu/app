// @vitest-environment node
import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DatabaseTransaction } from '../../server/utils/database'

import { grantPlanArticleCredits } from '../../server/utils/articleCreditWallet'
import { ARTICLE_CREDIT_POLICY_VERSION } from '../../shared/utils/articleCredits'

const periodStart = new Date('2026-10-05T00:00:00Z')
const periodEnd = new Date('2026-11-05T00:00:00Z')
const input = {
  clientSiteId: 'site1',
  plan: 'PRO',
  idempotencyKey: 'invoice1',
  reason: 'Included articles',
  periodStart,
  periodEnd,
}

const makeTx = (granted = 0) => ({
  $queryRaw: vi.fn().mockResolvedValue([{ id: 'site1' }]),
  articleCreditGrant: {
    findUnique: vi.fn().mockResolvedValue(null),
    aggregate: vi.fn().mockResolvedValue({ _sum: { amount: granted } }),
    create: vi.fn().mockImplementation(async ({ data }) => ({ id: 'grant1', ...data })),
  },
  articleCreditWallet: {
    upsert: vi.fn().mockResolvedValue({ id: 'site1' }),
    update: vi.fn().mockResolvedValue({}),
  },
  articleCreditLedgerEntry: { create: vi.fn().mockResolvedValue({}) },
})

describe('plan article grants', () => {
  beforeEach(() => vi.stubGlobal('createError', createError))
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    ['PRO', 30],
    ['PREMIUM', 50],
  ])('credits a new %s period with %i articles', async (plan, amount) => {
    const tx = makeTx()
    await grantPlanArticleCredits(tx as unknown as DatabaseTransaction, { ...input, plan: String(plan) })
    expect(tx.articleCreditGrant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount,
        remaining: amount,
        source: 'PLAN',
        periodStart,
        periodEnd,
        expiresAt: periodEnd,
        policyVersion: ARTICLE_CREDIT_POLICY_VERSION,
      }),
    })
    expect(tx.articleCreditWallet.update).toHaveBeenCalledWith({
      where: { id: 'site1' },
      data: { balance: { increment: amount } },
    })
    expect(tx.articleCreditLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: 'CREDIT', amount }),
    })
  })

  it('adds only 20 articles when upgrading a current Pro allowance to Premium', async () => {
    const tx = makeTx(30)
    await grantPlanArticleCredits(tx as unknown as DatabaseTransaction, { ...input, plan: 'PREMIUM' })
    expect(tx.articleCreditGrant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ amount: 20, remaining: 20, expiresAt: periodEnd }),
    })
  })

  it.each([
    ['PRO', 20],
    ['PREMIUM', 30],
  ])('keeps a replayed %s grant from the previous policy unchanged', async (plan, amount) => {
    const tx = makeTx(Number(amount))
    const previous = {
      clientSiteId: 'site1',
      source: 'PLAN',
      amount,
      policyVersion: '2026-09-articles-v1',
    }
    tx.articleCreditGrant.findUnique.mockResolvedValue(previous)
    expect(await grantPlanArticleCredits(tx as unknown as DatabaseTransaction, { ...input, plan: String(plan) })).toBe(
      previous,
    )
    expect(tx.articleCreditGrant.findUnique).toHaveBeenCalledWith({ where: { idempotencyKey: 'invoice1' } })
    expect(tx.articleCreditGrant.aggregate).not.toHaveBeenCalled()
    expect(tx.articleCreditGrant.create).not.toHaveBeenCalled()
    expect(tx.articleCreditWallet.update).not.toHaveBeenCalled()
    expect(tx.articleCreditLedgerEntry.create).not.toHaveBeenCalled()
  })

  it('keeps granted articles after a downgrade', async () => {
    const tx = makeTx(50)
    await grantPlanArticleCredits(tx as unknown as DatabaseTransaction, input)
    expect(tx.articleCreditGrant.create).not.toHaveBeenCalled()
    expect(tx.articleCreditWallet.update).not.toHaveBeenCalled()
  })

  it.each([
    { clientSiteId: 'other-site', source: 'PLAN' },
    { clientSiteId: 'site1', source: 'PURCHASE' },
  ])('rejects a reused key belonging to $clientSiteId / $source', async (previous) => {
    const tx = makeTx()
    tx.articleCreditGrant.findUnique.mockResolvedValue(previous)
    await expect(grantPlanArticleCredits(tx as unknown as DatabaseTransaction, input)).rejects.toMatchObject({
      statusCode: 409,
    })
    expect(tx.articleCreditWallet.update).not.toHaveBeenCalled()
  })
})

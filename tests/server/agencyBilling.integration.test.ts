// @vitest-environment node
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { DatabaseTransaction } from '../../server/utils/database'

import { stubNitroImports } from '../helpers/nitroImports'
import { toDatabaseJson } from '../../server/utils/databaseJson'
import { AI_ALLOWANCES } from '../../shared/utils/billingCatalog'
import { createDatabaseClient } from '../../server/utils/database'
import { stubBillingAccountImports } from '../helpers/billingImports'
import { agencyAllowances, agencyUnits } from '../../shared/utils/agencyPlan'
import { ARTICLE_CREDIT_POLICY_VERSION } from '../../shared/utils/articleCredits'
import {
  creditAgencyInvoiceAiBudget,
  getAccountAiBudget,
  getAiAllowance,
  reserveAiAllowance,
  settleAiAllowance,
} from '../../server/utils/aiAllowance'
import {
  agencyBlogUsage,
  agencyPeriods,
  revokeAgencyAccess,
  syncAgencyMemberships,
  syncAgencySites,
  withAgencyLease,
} from '../../server/utils/agency'
import {
  getAccountWallet,
  getArticleCreditWallet,
  grantPlanArticleCredits,
  reserveArticleCredit,
  settleArticleCredit,
} from '../../server/utils/articleCreditWallet'

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url) : null

describe.skipIf(!enabled)('agency billing accounts on PostgreSQL', () => {
  beforeAll(async () => {
    await stubBillingAccountImports()
    vi.stubGlobal('prisma', db)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('toDatabaseJson', toDatabaseJson)
    vi.stubGlobal('reportCaughtError', vi.fn())
    vi.stubGlobal('ARTICLE_CREDIT_POLICY_VERSION', ARTICLE_CREDIT_POLICY_VERSION)
    vi.stubGlobal('serializableTransaction', (work: (tx: DatabaseTransaction) => Promise<unknown>) =>
      db!.$transaction(work),
    )
    vi.stubGlobal('isAgencyPriceId', (id: string) => id === 'price_agency_blog' || id === 'price_agency_units')
    vi.stubGlobal('planFromPriceId', () => null)
    vi.stubGlobal('syncPlanFeatures', vi.fn())
    await stubNitroImports(import('../../server/utils/tenantMembership'), 'TENANT_SCOPES')
    await stubNitroImports(import('../../server/utils/articleCreditWallet'), 'creditArticleCredits')
    await stubNitroImports(import('../../server/utils/aiAllowance'), 'agencyInvoiceNetCents')
  })
  afterAll(async () => {
    await db?.$disconnect()
    vi.unstubAllGlobals()
  })

  const start = () => new Date(Date.now() - 86400000)
  const end = () => new Date(Date.now() + 29 * 86400000)

  const agency = async ({ blogs = 3, premium = 0, blocks = 4, units = agencyUnits(4) } = {}) => {
    const account = await db!.billingAccount.create({
      data: {
        kind: 'AGENCY',
        name: 'Agency',
        status: 'ACTIVE',
        blogSlots: blogs,
        premiumSlots: premium,
        unitBlocks: blocks,
      },
    })
    const sites = []
    for (let index = 0; index < 2; index++) {
      const id = randomUUID()
      await db!.clientSite.create({
        data: {
          id,
          name: `agency-${id}`,
          domain: `${id}.test`,
          plan: 'PRO',
          agencyPlan: 'PRO',
          billingAccountId: account.id,
          createdAt: new Date(Date.now() - (2 - index) * 1000),
        },
      })
      sites.push(id)
    }
    if (units)
      await db!.$transaction((tx) =>
        grantPlanArticleCredits(tx, {
          accountId: account.id,
          amount: units,
          idempotencyKey: `agency-fixture:${account.id}`,
          reason: 'Agency units',
          periodStart: start(),
          periodEnd: end(),
        }),
      )
    return { accountId: account.id, a: sites[0]!, b: sites[1]! }
  }

  it('lets every agency blog spend one shared pool and attributes each charge to its blog', async () => {
    const f = await agency({ units: 10 })
    await settleArticleCredit(await reserveArticleCredit(f.a, 'MANUAL_ARTICLE', randomUUID(), {}, 6), true)
    await settleArticleCredit(await reserveArticleCredit(f.b, 'MANUAL_ARTICLE', randomUUID(), {}, 4), true)
    await expect(reserveArticleCredit(f.b, 'MANUAL_ARTICLE')).rejects.toMatchObject({ statusCode: 402 })
    expect(await getArticleCreditWallet(f.a)).toMatchObject({ pooled: true, available: 0 })
    const debits = await db!.articleCreditLedgerEntry.findMany({
      where: { accountId: f.accountId, kind: 'DEBIT' },
      select: { clientSiteId: true, amount: true },
    })
    expect(debits).toEqual(
      expect.arrayContaining([
        { clientSiteId: f.a, amount: -6 },
        { clientSiteId: f.b, amount: -4 },
      ]),
    )
    // The blogs' own DIRECT wallets were never touched.
    expect(await db!.articleCreditWallet.findUnique({ where: { id: f.a } })).toBeNull()
  })

  it('stops one blog at its per-period limit while the others keep spending', async () => {
    const f = await agency()
    await db!.clientSite.update({ where: { id: f.a }, data: { monthlyUnitLimit: 3 } })
    await settleArticleCredit(await reserveArticleCredit(f.a, 'MANUAL_ARTICLE', randomUUID(), {}, 3), true)
    await expect(reserveArticleCredit(f.a, 'MANUAL_ARTICLE')).rejects.toMatchObject({
      statusCode: 402,
      data: { code: 'BLOG_UNIT_LIMIT_REACHED', limit: 3, used: 3 },
    })
    // A released reservation does not count against the limit.
    await settleArticleCredit(await reserveArticleCredit(f.b, 'MANUAL_ARTICLE', randomUUID(), {}, 5), false)
    await expect(reserveArticleCredit(f.b, 'MANUAL_ARTICLE', randomUUID(), {}, 5)).resolves.toBeTruthy()
  })

  it('returns a reservation to the pool it came from after the blog leaves the agency', async () => {
    const f = await agency({ units: 5 })
    const operation = await reserveArticleCredit(f.a, 'MANUAL_ARTICLE', randomUUID(), {}, 2)
    await db!.clientSite.update({
      where: { id: f.a },
      data: { billingAccountId: null, agencyPlan: null, plan: 'BASIC' },
    })
    await settleArticleCredit(operation, false)
    expect((await getAccountWallet(f.accountId)).available).toBe(5)
    expect((await getArticleCreditWallet(f.a)).available).toBe(0)
  })

  it('funds agency AI from the pool, at most half of the list price', async () => {
    const f = await agency()
    const allowance = await getAiAllowance(f.a)
    const expected = agencyAllowances({ blogs: 3, premium: 0, blocks: 4 })
    expect(allowance).toMatchObject({ active: true, pooled: true })
    expect(allowance.allowances.find((row) => row.kind === 'BUDGET')?.total).toBe(expected.BUDGET)
    expect(expected.BUDGET).toBe((3 * 1000 + 4 * 3000) * 5000)
    // Both blogs read the same pool.
    await settleAiAllowance(await reserveAiAllowance(f.a, 'BUDGET', 1_000_000), 1_000_000)
    expect((await getAiAllowance(f.b)).allowances.find((row) => row.kind === 'BUDGET')?.remaining).toBe(
      expected.BUDGET - 1_000_000,
    )
  })

  it('charges a provider-cost overrun to the agency, not to the blog that ran it', async () => {
    const f = await agency()
    const reservation = await reserveAiAllowance(f.a, 'BUDGET', 100)
    await settleAiAllowance(reservation, 600)
    expect(await db!.billingAccount.findUniqueOrThrow({ where: { id: f.accountId } })).toMatchObject({
      aiBudgetDebtMicros: 500,
    })
    expect(await db!.clientSite.findUniqueOrThrow({ where: { id: f.a } })).toMatchObject({ aiBudgetDebtMicros: 0 })
    await reserveAiAllowance(f.b, 'BUDGET', 1)
    expect(await db!.billingAccount.findUniqueOrThrow({ where: { id: f.accountId } })).toMatchObject({
      aiBudgetDebtMicros: 0,
    })
  })

  it('keeps a free agency blog out of the shared pool while the others spend it', async () => {
    const f = await agency()
    await db!.clientSite.update({ where: { id: f.a }, data: { agencyPlan: 'BASIC', plan: 'BASIC' } })
    await expect(reserveArticleCredit(f.a, 'MANUAL_ARTICLE')).rejects.toMatchObject({
      statusCode: 403,
      data: { code: 'AI_PLAN_REQUIRED' },
    })
    await expect(reserveAiAllowance(f.a, 'BUDGET', 1)).rejects.toMatchObject({ data: { code: 'AI_PLAN_REQUIRED' } })
    expect(await getAiAllowance(f.a)).toMatchObject({ active: false })
    await expect(reserveArticleCredit(f.b, 'MANUAL_ARTICLE')).resolves.toBeTruthy()
    await expect(reserveAiAllowance(f.b, 'BUDGET', 1)).resolves.toBeTruthy()
  })

  it('funds AI visibility for each PREMIUM add-on, shared by the PREMIUM blogs', async () => {
    const f = await agency({ premium: 2 })
    await db!.clientSite.update({ where: { id: f.a }, data: { agencyPlan: 'PREMIUM', plan: 'PREMIUM' } })
    const visibility = (await getAiAllowance(f.a)).allowances.find((row) => row.kind === 'VISIBILITY')
    expect(visibility?.total).toBe(2 * AI_ALLOWANCES.PREMIUM.VISIBILITY)
    expect(agencyAllowances({ blogs: 3, premium: 2, blocks: 4 }).BUDGET).toBe((3 * 1000 + 2 * 2000 + 4 * 3000) * 5000)
  })

  it('steps blog plans down to what the slots pay for, newest blog first, and back to BASIC when the agency ends', async () => {
    const f = await agency({ premium: 1 })
    await db!.clientSite.updateMany({
      where: { id: { in: [f.a, f.b] } },
      data: { agencyPlan: 'PREMIUM', plan: 'PREMIUM' },
    })
    await syncAgencySites(f.accountId)
    const plans = async () =>
      Object.fromEntries(
        (
          await db!.clientSite.findMany({
            where: { id: { in: [f.a, f.b] } },
            select: { id: true, plan: true, agencyPlan: true },
          })
        ).map((row) => [row.id === f.a ? 'a' : 'b', `${row.agencyPlan}/${row.plan}`]),
      )
    expect(await plans()).toEqual({ a: 'PREMIUM/PREMIUM', b: 'PRO/PRO' })

    await db!.billingAccount.update({ where: { id: f.accountId }, data: { blogSlots: 1 } })
    await syncAgencySites(f.accountId)
    expect(await plans()).toEqual({ a: 'PREMIUM/PREMIUM', b: 'BASIC/BASIC' })

    // The pick survives a lapse, so a renewed subscription restores it.
    await db!.billingAccount.update({ where: { id: f.accountId }, data: { status: 'CANCELED' } })
    await syncAgencySites(f.accountId)
    expect(await plans()).toEqual({ a: 'PREMIUM/BASIC', b: 'BASIC/BASIC' })
  })

  it('refuses AI work once the agency subscription has ended', async () => {
    const f = await agency()
    await db!.billingAccount.update({ where: { id: f.accountId }, data: { status: 'CANCELED' } })
    await expect(reserveAiAllowance(f.a, 'EDIT')).rejects.toMatchObject({ data: { code: 'AI_PLAN_REQUIRED' } })
  })

  it('funds half of a paid agency invoice once and only the paid part of an upgrade', async () => {
    const f = await agency({ units: 0 })
    const line = (price: string, amount: number, quantity: number) => ({
      pricing: { price_details: { price } },
      amount,
      quantity,
      discount_amounts: [],
    })
    const cycle = {
      id: `in_cycle_${f.accountId}`,
      currency: 'usd',
      billing_reason: 'subscription_create',
      lines: { data: [line('price_agency_blog', 3000, 3), line('price_agency_units', 12000, 4)] },
    }
    const periodStart = start()
    const periodEnd = end()
    const credit = (invoice: object, recurringBaseCents?: number) =>
      db!.$transaction((tx) =>
        creditAgencyInvoiceAiBudget(tx, {
          accountId: f.accountId,
          invoice: invoice as never,
          periodStart,
          periodEnd,
          recurringBaseCents,
        }),
      )
    await credit(cycle)
    await credit(cycle)
    expect(await getAccountAiBudget(f.accountId)).toMatchObject({ total: 15000 * 5000 })

    // Two more blocks mid-period: the proration paid $25, the new monthly base is $210.
    const upgrade = {
      id: `in_up_${f.accountId}`,
      currency: 'usd',
      billing_reason: 'subscription_update',
      lines: { data: [line('price_agency_units', -6000, 4), line('price_agency_units', 8500, 6)] },
    }
    await credit(upgrade, 21000)
    await credit(upgrade, 21000)
    expect(await getAccountAiBudget(f.accountId)).toMatchObject({ total: 15000 * 5000 + 2500 * 5000 })
    expect(await db!.billingAccount.findUniqueOrThrow({ where: { id: f.accountId } })).toMatchObject({
      aiBudgetMonthlyMicros: 21000 * 5000,
    })
  })

  it('grants only the unit difference for a mid-period block increase', async () => {
    const f = await agency()
    await db!.$transaction(async (tx) => {
      const slot = await tx.articleCreditGrant.findFirstOrThrow({ where: { accountId: f.accountId, source: 'PLAN' } })
      await grantPlanArticleCredits(tx, {
        accountId: f.accountId,
        amount: agencyUnits(6),
        idempotencyKey: `agency-up:${f.accountId}`,
        reason: 'Agency units',
        periodStart: slot.periodStart!,
        periodEnd: slot.periodEnd!,
      })
    })
    expect((await getAccountWallet(f.accountId)).available).toBe(agencyUnits(6))
  })

  it('projects agency members onto every agency blog and never rewrites a blog team row', async () => {
    const f = await agency()
    const person = async (label: string) =>
      db!.user.create({
        data: {
          username: `${label}-${randomUUID().slice(0, 8)}`,
          email: `${randomUUID()}@agency.test`,
          emailVerified: true,
        },
      })
    const [owner, writer, client] = await Promise.all([person('owner'), person('writer'), person('client')])
    await db!.billingAccountMember.createMany({
      data: [
        { accountId: f.accountId, userId: owner.id, role: 'OWNER' },
        { accountId: f.accountId, userId: writer.id, role: 'MEMBER', scopes: ['ARTICLE_WRITE'] },
      ],
    })
    // The client's own row on blog A stays theirs.
    await db!.tenantMembership.create({
      data: { clientSiteId: f.a, userId: client.id, role: 'OWNER', scopes: ['BILLING_CHANGE'] },
    })
    await db!.tenantMembership.create({
      data: { clientSiteId: f.a, userId: writer.id, role: 'MEMBER', scopes: ['ANALYTICS_READ'] },
    })
    await syncAgencyMemberships(f.accountId)
    await syncAgencyMemberships(f.accountId)

    const rows = await db!.tenantMembership.findMany({
      where: { clientSiteId: { in: [f.a, f.b] } },
      select: { clientSiteId: true, userId: true, role: true, scopes: true, billingAccountId: true },
    })
    expect(rows).toHaveLength(5)
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          clientSiteId: f.b,
          userId: owner.id,
          role: 'MEMBER',
          scopes: expect.arrayContaining(['BILLING_CHANGE']),
          billingAccountId: f.accountId,
        }),
        expect.objectContaining({ clientSiteId: f.b, userId: writer.id, scopes: ['ARTICLE_WRITE'] }),
        expect.objectContaining({
          clientSiteId: f.a,
          userId: writer.id,
          scopes: ['ANALYTICS_READ'],
          billingAccountId: null,
        }),
        expect.objectContaining({ clientSiteId: f.a, userId: client.id, role: 'OWNER', billingAccountId: null }),
      ]),
    )

    // Leaving the agency removes only projected access; the blog team's own rows remain.
    await db!.clientSite.update({ where: { id: f.b }, data: { billingAccountId: null, agencyPlan: null } })
    await syncAgencyMemberships(f.accountId)
    expect(await db!.tenantMembership.count({ where: { clientSiteId: f.b } })).toBe(0)

    await db!.$transaction((tx) => revokeAgencyAccess(tx, f.accountId, { userId: owner.id }))
    expect(await db!.tenantMembership.count({ where: { userId: owner.id } })).toBe(0)
    expect(await db!.tenantMembership.count({ where: { userId: client.id } })).toBe(1)
  })

  it('changes a blog plan only within the slots and frees the slot of a deleted blog', async () => {
    const f = await agency({ blogs: 1, premium: 1 })
    await db!.clientSite.update({ where: { id: f.b }, data: { agencyPlan: 'BASIC', plan: 'BASIC' } })
    let request: { id: string; body: unknown } = { id: f.a, body: {} }
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('requireAgencyMember', async () => ({
      user: { id: randomUUID() },
      member: { accountId: f.accountId },
    }))
    vi.stubGlobal('getRouterParam', () => request.id)
    vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (body: unknown) => unknown) =>
      parse(request.body),
    )
    vi.stubGlobal('logAction', vi.fn())
    vi.stubGlobal('getIp', () => '203.0.113.9')
    await stubNitroImports(import('../../server/utils/agency'), 'agencyBlogPlans')
    const patch = (await import('../../server/api/agency/blogs/[id].patch')).default as (
      event: never,
    ) => Promise<unknown>
    const send = (id: string, body: unknown) => {
      request = { id, body }
      return patch({} as never)
    }
    const plan = async (id: string) =>
      db!.clientSite.findUniqueOrThrow({ where: { id }, select: { agencyPlan: true, plan: true } })

    await send(f.a, { plan: 'PREMIUM' })
    expect(await plan(f.a)).toEqual({ agencyPlan: 'PREMIUM', plan: 'PREMIUM' })
    await expect(send(f.b, { plan: 'PRO' })).rejects.toMatchObject({ statusCode: 409, data: { code: 'NO_FREE_SLOT' } })
    await expect(send(f.b, { plan: 'PREMIUM' })).rejects.toMatchObject({ data: { code: 'NO_FREE_SLOT' } })
    expect(await plan(f.b)).toEqual({ agencyPlan: 'BASIC', plan: 'BASIC' })

    await db!.billingAccount.update({ where: { id: f.accountId }, data: { blogSlots: 2 } })
    await expect(send(f.b, { plan: 'PREMIUM' })).rejects.toMatchObject({ data: { code: 'NO_FREE_PREMIUM_SLOT' } })
    await send(f.b, { plan: 'PRO', monthlyUnitLimit: 20 })
    expect(await db!.clientSite.findUniqueOrThrow({ where: { id: f.b } })).toMatchObject({
      agencyPlan: 'PRO',
      plan: 'PRO',
      monthlyUnitLimit: 20,
    })

    await db!.clientSite.update({ where: { id: f.a }, data: { deletedAt: new Date() } })
    await send(f.b, { plan: 'PREMIUM' })
    expect(await plan(f.b)).toEqual({ agencyPlan: 'PREMIUM', plan: 'PREMIUM' })

    // A lapsed agency keeps the pick but serves BASIC.
    await db!.billingAccount.update({ where: { id: f.accountId }, data: { status: 'CANCELED' } })
    await send(f.b, { plan: 'PRO' })
    expect(await plan(f.b)).toEqual({ agencyPlan: 'PRO', plan: 'BASIC' })
  })

  it('queues a waiting caller behind a held agency lease and refuses one that does not wait', async () => {
    const { accountId } = await agency({ units: 0 })
    const order: string[] = []
    let release!: () => void
    const held = withAgencyLease(accountId, async () => {
      order.push('first')
      await new Promise<void>((resolve) => (release = resolve))
    })
    await vi.waitFor(() => expect(order).toEqual(['first']))
    await expect(withAgencyLease(accountId, async () => order.push('impatient'))).rejects.toMatchObject({
      statusCode: 409,
    })
    const waiting = withAgencyLease(accountId, async () => order.push('second'), { waitMs: 5000 })
    setTimeout(() => release(), 400)
    await Promise.all([held, waiting])
    expect(order).toEqual(['first', 'second'])
    const account = await db!.billingAccount.findUniqueOrThrow({
      where: { id: accountId },
      omit: { billingLeaseId: false },
    })
    expect(account.billingLeaseId).toBeNull()
  })

  it('reports what a blog spent from the pool after it left, and each period on its own', async () => {
    const f = await agency({ units: 10 })
    await settleArticleCredit(await reserveArticleCredit(f.a, 'MANUAL_ARTICLE', randomUUID(), {}, 3), true)
    await settleArticleCredit(await reserveArticleCredit(f.b, 'MANUAL_ARTICLE', randomUUID(), {}, 2), true)
    await db!.clientSite.update({
      where: { id: f.a },
      data: { billingAccountId: null, agencyPlan: null, plan: 'BASIC' },
    })
    // A finished period: its grant is spent and one charge falls inside it.
    const past = { start: new Date(Date.now() - 31 * 86400000), end: new Date(Date.now() - 2 * 86400000) }
    await db!.articleCreditGrant.create({
      data: {
        accountId: f.accountId,
        source: 'PLAN',
        amount: 10,
        remaining: 0,
        periodStart: past.start,
        periodEnd: past.end,
        expiresAt: past.end,
        policyVersion: ARTICLE_CREDIT_POLICY_VERSION,
        idempotencyKey: `agency-past:${f.accountId}`,
      },
    })
    await db!.articleCreditOperation.create({
      data: {
        accountId: f.accountId,
        clientSiteId: f.b,
        action: 'MANUAL_ARTICLE',
        status: 'COMPLETED',
        reserved: 4,
        charged: 4,
        allocations: [],
        metadata: {},
        idempotencyKey: `agency-past-operation:${f.accountId}`,
        expiresAt: past.end,
        createdAt: new Date(past.end.getTime() - 86400000),
      },
    })

    const current = await agencyBlogUsage(f.accountId)
    expect(current.usedUnits).toBe(5)
    expect(current.blogs.map(({ id, unitsUsed }) => ({ id, unitsUsed }))).toEqual([{ id: f.b, unitsUsed: 2 }])
    expect(current.former).toEqual([expect.objectContaining({ id: f.a, unitsUsed: 3 })])

    const periods = await agencyPeriods(f.accountId)
    expect(periods).toHaveLength(2)
    expect(periods[1]).toEqual(past)
    const previous = await agencyBlogUsage(f.accountId, past)
    expect(previous.usedUnits).toBe(4)
    expect(previous.blogs.map(({ id, unitsUsed }) => ({ id, unitsUsed }))).toEqual([{ id: f.b, unitsUsed: 4 }])
    expect(previous.former).toEqual([])
  })

  it('gives every new blog its own DIRECT account in the database', async () => {
    const id = randomUUID()
    await db!.clientSite.create({ data: { id, name: `direct-${id}`, domain: `${id}.test` } })
    expect(await db!.billingAccount.findUnique({ where: { id } })).toMatchObject({ kind: 'DIRECT', directSiteId: id })
  })
})

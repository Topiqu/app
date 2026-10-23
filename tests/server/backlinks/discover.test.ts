// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/backlinks/suppliers'), 'findSuppliers')
  await stubNitroImports(import('../../../server/utils/keywords/dataforseo'), 'hasDataForSeo')
  await stubNitroImports(import('../../../server/utils/backlinks/mentions'), 'findMentions')
}

vi.mock('../../../server/utils/keywords/dataforseo', () => ({ dataForSeo: vi.fn(), hasDataForSeo: () => true }))
const findMentions = vi.fn()
vi.mock('../../../server/utils/backlinks/mentions', () => ({ findMentions }))
const findSuppliers = vi.fn()
vi.mock('../../../server/utils/backlinks/suppliers', () => ({ findSuppliers }))

await stubImports()

const { discoverBacklinks } = await import('../../../server/utils/backlinks/discover')

const NOW = new Date('2026-10-07T06:00:00Z')
const site = {
  id: 's1',
  name: 'Kávovar Alfa',
  domain: 'alfa.topiqu.com',
  websiteUrl: 'https://kavovar-alfa.cz',
  language: 'cs',
  keywordMarket: null,
  focus: 'káva',
  plan: 'PREMIUM',
}
const link = { href: 'https://kavovar-alfa.cz/', rel: [], anchor: 'Alfa' }
const opportunity = (sourceUrl: string) => ({
  sourceUrl,
  sourceDomain: new URL(sourceUrl).hostname,
  title: 'T',
  contactUrl: null,
  evidence: { term: 'Kávovar Alfa' },
})

let db: Record<string, Record<string, ReturnType<typeof vi.fn>>>

beforeEach(() => {
  db = {
    clientSite: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue(site),
      update: vi.fn(),
    },
    backlinkOpportunity: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    backlink: { upsert: vi.fn() },
  }
  vi.stubGlobal('prisma', db)
  vi.stubGlobal('logAction', vi.fn())
  findMentions.mockResolvedValue({ found: [], opportunities: [], costUsd: 0.05, searched: 3 })
  findSuppliers.mockResolvedValue({ found: [], opportunities: [], costUsd: 0.01, searched: 2 })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('discoverBacklinks', () => {
  it('claims the tenant past the cooldown and does no paid work when the claim fails', async () => {
    db.clientSite.updateMany!.mockResolvedValue({ count: 0 })
    expect(await discoverBacklinks('s1', { now: NOW, cooldownDays: 7 })).toEqual({ skipped: 'cooldown' })
    expect(db.clientSite.updateMany).toHaveBeenCalledWith({
      where: {
        id: 's1',
        OR: [{ backlinksAttemptedAt: null }, { backlinksAttemptedAt: { lt: new Date('2026-09-30T06:00:00Z') } }],
      },
      data: { backlinksAttemptedAt: NOW },
    })
    expect(findMentions).not.toHaveBeenCalled()
  })

  it('runs only the sources the plan allows', async () => {
    db.clientSite.findUnique!.mockResolvedValue({ ...site, plan: 'PRO' })
    await discoverBacklinks('s1', { now: NOW })
    expect(findMentions).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }), [
      'alfa.topiqu.com',
      'kavovar-alfa.cz',
    ])
    expect(findSuppliers).not.toHaveBeenCalled()
  })

  it('opens new opportunities pointing at the company website and keeps decided ones untouched', async () => {
    findMentions.mockResolvedValue({
      found: [],
      opportunities: [opportunity('https://new.cz/a'), opportunity('https://sent.cz/b')],
      costUsd: 0,
      searched: 2,
    })
    db.backlinkOpportunity.findUnique!.mockImplementation(async ({ where }) =>
      where.clientSiteId_kind_sourceUrl.sourceUrl === 'https://sent.cz/b' ? { status: 'SENT' } : null,
    )
    const summary = await discoverBacklinks('s1', { now: NOW })
    expect(db.backlinkOpportunity.create).toHaveBeenCalledTimes(1)
    expect(db.backlinkOpportunity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientSiteId: 's1',
        kind: 'UNLINKED_MENTION',
        sourceUrl: 'https://new.cz/a',
        targetUrl: 'https://kavovar-alfa.cz/',
      }),
    })
    expect(db.backlinkOpportunity.update).not.toHaveBeenCalled()
    expect(summary).toMatchObject({ opened: 1, found: 0, failures: 0, costUsd: 0.01 })
  })

  it('closes a pending request as WON when its page now links and records the link', async () => {
    findSuppliers.mockResolvedValue({
      found: [{ sourceUrl: 'https://brand.cz/prodejci', sourceDomain: 'brand.cz', link }],
      opportunities: [],
      costUsd: 0,
      searched: 1,
    })
    db.backlinkOpportunity.findFirst!.mockResolvedValue({ id: 'o1' })
    await discoverBacklinks('s1', { now: NOW })
    expect(db.backlinkOpportunity.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: 'WON', decidedAt: NOW, nextCheckAt: null },
    })
    expect(db.backlink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientSiteId_sourceUrl: { clientSiteId: 's1', sourceUrl: 'https://brand.cz/prodejci' } },
        create: expect.objectContaining({ opportunityId: 'o1', firstSeenAt: NOW, rel: [], anchor: 'Alfa' }),
      }),
    )
  })

  it('keeps one source when the other fails and stamps the refresh', async () => {
    findSuppliers.mockRejectedValue(new Error('SERP down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const summary = await discoverBacklinks('s1', { now: NOW })
    expect(summary).toMatchObject({ failures: 1, mentions: 3, suppliers: null })
    expect(db.clientSite.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { backlinksRefreshedAt: NOW } })
  })

  it('does not stamp a refresh when every source fails', async () => {
    findMentions.mockRejectedValue(new Error('down'))
    findSuppliers.mockRejectedValue(new Error('down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await discoverBacklinks('s1', { now: NOW })
    expect(db.clientSite.update).not.toHaveBeenCalled()
  })
})

beforeEach(stubImports)

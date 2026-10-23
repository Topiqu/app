// @vitest-environment node
import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/backlinks/check'), 'checkOpportunity')
  await stubNitroImports(import('../../../server/utils/backlinks/outreach'), 'draftOutreach')
  await stubNitroImports(import('../../../server/utils/keywords/dataforseo'), 'hasDataForSeo')
  await stubNitroImports(
    import('../../../server/utils/backlinks/discover'),
    'claimBacklinkDiscovery',
    'runBacklinkDiscovery',
  )
}

vi.mock('../../../server/utils/keywords/dataforseo', () => ({ dataForSeo: vi.fn(), hasDataForSeo: () => true }))
const draftOutreach = vi.fn()
vi.mock('../../../server/utils/backlinks/outreach', () => ({ draftOutreach }))
const checkOpportunity = vi.fn()
vi.mock('../../../server/utils/backlinks/check', () => ({ checkOpportunity }))
const claimBacklinkDiscovery = vi.fn()
const runBacklinkDiscovery = vi.fn()
vi.mock('../../../server/utils/backlinks/discover', () => ({ claimBacklinkDiscovery, runBacklinkDiscovery }))

let action: string
let scopes: string[]
let plan: string
let user: { id: string; role: string; clientSiteId: string }
let db: {
  backlinkOpportunity: Record<string, ReturnType<typeof vi.fn>>
  clientSite: { findUnique: ReturnType<typeof vi.fn> }
}

const target = {
  id: 'o1',
  clientSiteId: 'site1',
  kind: 'UNLINKED_MENTION',
  status: 'OPEN',
  sourceUrl: 'https://blog.cz/a',
  sourceDomain: 'blog.cz',
  title: null,
  evidence: { term: 'Alfa' },
  targetUrl: 'https://alfa.cz/',
  sentAt: null,
}

beforeEach(() => {
  vi.resetAllMocks()
  action = 'sent'
  scopes = ['ANALYTICS_READ', 'AI_USE']
  plan = 'PREMIUM'
  user = { id: 'u1', role: 'admin', clientSiteId: 'site1' }
  db = {
    backlinkOpportunity: {
      findFirst: vi.fn().mockResolvedValue(target),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn(),
    },
    clientSite: {
      findUnique: vi.fn().mockImplementation(async () => ({
        id: 'site1',
        name: 'Alfa',
        domain: 'alfa.topiqu.com',
        websiteUrl: null,
        language: 'cs',
        focus: null,
        plan,
        backlinksAttemptedAt: null,
      })),
    },
  }
  vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal(
    'requireDb',
    vi.fn().mockImplementation(async () => ({ user, db })),
  )
  vi.stubGlobal('getRouterParam', () => 'o1')
  vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (input: unknown) => unknown) => parse({ action }))
  vi.stubGlobal(
    'requireTenantScope',
    vi.fn().mockImplementation(async (_event: unknown, scope: string) => {
      if (!scopes.includes(scope)) throw createError({ statusCode: 403, message: `Missing tenant scope: ${scope}` })
      return { membership: { scopes } }
    }),
  )
  vi.stubGlobal('hasActiveFeature', vi.fn().mockResolvedValue(true))
  vi.stubGlobal('consumeRateLimit', vi.fn().mockResolvedValue(true))
  vi.stubGlobal('logAction', vi.fn())
  vi.stubGlobal('reportCaughtError', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())

const opportunityRoute = async () =>
  (await import('../../../server/api/backlinks/[id].post')).default as (event: unknown) => Promise<unknown>
const discoverRoute = async () =>
  (await import('../../../server/api/backlinks/discover.post')).default as (event: unknown) => Promise<unknown>

describe('backlink opportunity route', () => {
  it('looks the opportunity up inside the session tenant and 404s a foreign id', async () => {
    db.backlinkOpportunity.findFirst!.mockResolvedValue(null)
    await expect((await opportunityRoute())({})).rejects.toMatchObject({ statusCode: 404 })
    expect(db.backlinkOpportunity.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'o1', clientSiteId: 'site1' } }),
    )
    expect(db.backlinkOpportunity.updateMany).not.toHaveBeenCalled()
  })

  it('requires analytics access for every action', async () => {
    scopes = []
    await expect((await opportunityRoute())({})).rejects.toMatchObject({ statusCode: 403 })
    expect(db.backlinkOpportunity.findFirst).not.toHaveBeenCalled()
  })

  it('marks an OPEN request sent with a guarded write and schedules the first check', async () => {
    expect(await (await opportunityRoute())({})).toEqual({ status: 'SENT' })
    expect(db.backlinkOpportunity.updateMany).toHaveBeenCalledWith({
      where: { id: 'o1', clientSiteId: 'site1', status: { in: ['OPEN'] } },
      data: expect.objectContaining({ status: 'SENT', sentAt: expect.any(Date), nextCheckAt: expect.any(Date) }),
    })
  })

  it('answers 409 when the opportunity changed meanwhile', async () => {
    db.backlinkOpportunity.updateMany!.mockResolvedValue({ count: 0 })
    await expect((await opportunityRoute())({})).rejects.toMatchObject({ statusCode: 409 })
  })

  it('needs AI_USE and a Premium plan for a draft', async () => {
    action = 'draft'
    scopes = ['ANALYTICS_READ']
    await expect((await opportunityRoute())({})).rejects.toMatchObject({ statusCode: 403 })
    scopes = ['ANALYTICS_READ', 'AI_USE']
    plan = 'PRO'
    await expect((await opportunityRoute())({})).rejects.toMatchObject({ statusCode: 403 })
    expect(draftOutreach).not.toHaveBeenCalled()
  })

  it('stores a draft written for the signed-in user', async () => {
    action = 'draft'
    draftOutreach.mockResolvedValue({ subject: 'S', body: 'B' })
    expect(await (await opportunityRoute())({})).toEqual({ draft: { subject: 'S', body: 'B' } })
    expect(draftOutreach).toHaveBeenCalledWith(expect.objectContaining({ id: 'site1' }), expect.anything(), 'u1')
    expect(db.backlinkOpportunity.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { draft: { subject: 'S', body: 'B' } },
    })
  })

  it('rate-limits drafts per tenant', async () => {
    action = 'draft'
    vi.mocked(consumeRateLimit).mockResolvedValue(false)
    await expect((await opportunityRoute())({})).rejects.toMatchObject({ statusCode: 429 })
    expect(draftOutreach).not.toHaveBeenCalled()
  })
})

describe('backlink discovery route', () => {
  it('refuses a plan without backlinks before claiming paid work', async () => {
    plan = 'BASIC'
    await expect((await discoverRoute())({})).rejects.toMatchObject({ statusCode: 403 })
    expect(claimBacklinkDiscovery).not.toHaveBeenCalled()
  })

  it('answers 429 inside the cooldown and runs nothing', async () => {
    claimBacklinkDiscovery.mockResolvedValue(false)
    await expect((await discoverRoute())({})).rejects.toMatchObject({ statusCode: 429 })
    expect(runBacklinkDiscovery).not.toHaveBeenCalled()
  })

  it('claims, then starts the run in the background', async () => {
    claimBacklinkDiscovery.mockResolvedValue(true)
    runBacklinkDiscovery.mockResolvedValue({})
    expect(await (await discoverRoute())({})).toEqual({ started: true })
    expect(claimBacklinkDiscovery).toHaveBeenCalledWith('site1', expect.any(Date), 7)
    expect(runBacklinkDiscovery).toHaveBeenCalledWith('site1', expect.any(Date))
  })
})

beforeEach(stubImports)

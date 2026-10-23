import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../server/utils/domains/connections'), 'reconcileDomainConnection')
}

const provision = vi.hoisted(() => vi.fn())
vi.mock('../../server/utils/domains/connections', () => ({ reconcileDomainConnection: provision }))

const PENDING = 'blog.example.cz'
const OLD = 'acme.topiqu.com'

const site = (overrides = {}) => ({
  domain: OLD,
  plan: 'PRO',
  pendingDomain: PENDING,
  pendingDomainToken: 'token',
  pendingDomainRequestedAt: new Date('2026-10-01T00:00:00Z'),
  ...overrides,
})

const tx = {
  clientSite: { updateMany: vi.fn() },
  domainRedirect: { deleteMany: vi.fn(), upsert: vi.fn() },
}
const findSite = vi.fn()
const checkDomainDns = vi.fn()
const isDomainTaken = vi.fn()
const uncache = vi.fn()

beforeEach(() => {
  vi.resetModules()
  findSite.mockResolvedValue(site())
  provision.mockResolvedValue({ ready: true, state: 'READY' })
  checkDomainDns.mockResolvedValue({ ownershipVerified: true, routingVerified: true })
  isDomainTaken.mockResolvedValue(false)
  tx.clientSite.updateMany.mockResolvedValue({ count: 1 })
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('requireDomainAccess', async () => ({
    user: { id: 'u1' },
    db: {
      clientSite: { findUnique: findSite },
      domainConnection: { findUnique: async () => ({ id: 'c1', clientSiteId: 's1' }) },
    },
    clientSiteId: 's1',
  }))
  vi.stubGlobal('consumeRateLimit', async () => true)
  vi.stubGlobal('checkDomainDns', checkDomainDns)
  vi.stubGlobal('isDomainTaken', isDomainTaken)
  vi.stubGlobal('prisma', { $transaction: (run: (client: typeof tx) => unknown) => run(tx) })
  vi.stubGlobal('isUniqueViolation', () => false)
  vi.stubGlobal('uncache', uncache)
  vi.stubGlobal('tenantHostKey', (host: string) => `tenant:host:${host}`)
  vi.stubGlobal('domainRedirectKey', (host: string) => `domain:redirect:${host}`)
  vi.stubGlobal('logAction', vi.fn())
  vi.stubGlobal('getIp', () => '127.0.0.1')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const verify = async () => {
  const handler = (await import('../../server/api/domain/pending/verify.post')).default as unknown as (
    event: unknown,
  ) => Promise<unknown>
  return handler({})
}

describe('domain switch verification', () => {
  it('activates a free managed subdomain without external DNS or a paid plan', async () => {
    findSite.mockResolvedValue(site({ plan: 'BASIC', pendingDomain: 'fallback.topiqu.com' }))
    await expect(verify()).resolves.toEqual({ verified: true, domain: 'fallback.topiqu.com' })
    expect(checkDomainDns).not.toHaveBeenCalled()
    expect(tx.clientSite.updateMany.mock.calls[0]![0].data).toMatchObject({
      domainVerificationToken: null,
      domainVerified: true,
    })
  })

  it.each(['admin.topiqu.com', 'app.topiqu.com', 'nested.blog.topiqu.com', 'topiqu.com'])(
    'refuses reserved or nested managed host %s',
    async (pendingDomain) => {
      findSite.mockResolvedValue(site({ pendingDomain }))
      await expect(verify()).rejects.toMatchObject({ statusCode: 403 })
      expect(tx.clientSite.updateMany).not.toHaveBeenCalled()
      expect(checkDomainDns).not.toHaveBeenCalled()
    },
  )

  it('keeps the live domain while provider setup is incomplete', async () => {
    provision.mockResolvedValue({ ready: false, state: 'CERTIFICATE' })
    await expect(verify()).resolves.toEqual({ verified: false, ownership: true, routing: false, state: 'CERTIFICATE' })
    expect(tx.clientSite.updateMany).not.toHaveBeenCalled()
  })

  it('swaps to the proven domain and redirects the old host to it', async () => {
    await expect(verify()).resolves.toEqual({ verified: true, domain: PENDING })

    const update = tx.clientSite.updateMany.mock.calls[0]![0]
    expect(update.where).toEqual({ id: 's1', pendingDomain: PENDING, pendingDomainToken: 'token' })
    expect(update.data).toMatchObject({
      domain: PENDING,
      pendingDomain: null,
      domainVerified: true,
      domainVerificationStatus: 'VERIFIED',
      domainVerificationToken: 'token',
    })
    expect(tx.domainRedirect.upsert.mock.calls[0]![0]).toMatchObject({
      where: { host: OLD },
      create: { host: OLD, clientSiteId: 's1' },
    })
    expect(tx.domainRedirect.deleteMany).toHaveBeenCalledWith({ where: { host: PENDING, clientSiteId: 's1' } })
    expect(uncache).toHaveBeenCalledWith(
      `tenant:host:${OLD}`,
      `tenant:host:${PENDING}`,
      `domain:redirect:${OLD}`,
      `domain:redirect:${PENDING}`,
    )
  })

  it('refuses a tenant that lost the plan after requesting the change', async () => {
    findSite.mockResolvedValue(site({ plan: 'BASIC' }))
    await expect(verify()).rejects.toMatchObject({ statusCode: 403 })
    expect(checkDomainDns).not.toHaveBeenCalled()
  })

  it('refuses a domain another blog claimed meanwhile', async () => {
    isDomainTaken.mockResolvedValue(true)
    await expect(verify()).rejects.toMatchObject({ statusCode: 409 })
  })

  it('does not swap when the change was cancelled during the DNS check', async () => {
    tx.clientSite.updateMany.mockResolvedValue({ count: 0 })
    await expect(verify()).rejects.toMatchObject({ statusCode: 409 })
    expect(tx.domainRedirect.upsert).not.toHaveBeenCalled()
  })
})

beforeEach(stubImports)

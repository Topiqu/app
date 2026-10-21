import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  reconcileDomainConnection,
  reserveDomainConnection,
  withDomainLease,
} from '../../server/utils/domains/connections'

const mocks = vi.hoisted(() => ({ cf: vi.fn(), find: vi.fn(), dokploy: vi.fn(), probe: vi.fn() }))
vi.mock('../../server/utils/domains/providers', async (original) => ({
  ...(await original<typeof import('../../server/utils/domains/providers')>()),
  cloudflareDomain: mocks.cf,
  checkCloudflareFallback: async () => {},
  findDokployDomain: mocks.find,
  dokployRequest: mocks.dokploy,
  domainProviderConfig: () => ({ applicationId: 'app', organizationId: 'org', port: 3000 }),
}))
vi.mock('../../server/utils/domains/probe', () => ({ probeDomainRouting: mocks.probe }))

const row = () => ({
  id: 'c1',
  clientSiteId: 's1',
  host: 'blog.example.com',
  challenge: 'fixture',
  probeSecret: 'probe',
  cloudflareId: 'cf1',
  dokployId: 'd1',
  cloudflareManaged: true,
  dokployManaged: true,
  certificateId: null,
  certificateMode: 'AUTO',
  certificateExpiresAt: null,
  encryptedCertificate: null,
  cleanupRequestedAt: null,
  state: 'OWNERSHIP',
})
const record = vi.fn()
const updateMany = vi.fn()
const update = vi.fn()
const dns = vi.fn()
const site = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  record.mockResolvedValue(row())
  updateMany.mockResolvedValue({ count: 1 })
  site.mockResolvedValue({
    domain: 'blog.example.com',
    domainVerificationToken: 'fixture',
    plan: 'PRO',
    deletedAt: null,
  })
  dns.mockResolvedValue({ ownershipVerified: true, routingVerified: false, dnsStatus: { txt: 0, cname: 0 } })
  mocks.cf.mockResolvedValue({ id: 'cf1', hostname: 'blog.example.com', status: 'active', ssl: { status: 'active' } })
  mocks.find.mockResolvedValue({ domainId: 'd1', host: 'blog.example.com' })
  mocks.probe.mockResolvedValue(true)
  vi.stubGlobal('prisma', {
    domainConnection: { findUniqueOrThrow: record, updateMany, update },
    clientSite: { findUniqueOrThrow: site },
  })
  vi.stubGlobal('checkDomainDns', dns)
  vi.stubGlobal('reportCaughtError', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())

describe('domain connection lifecycle', () => {
  it('does not overwrite another claimant when reusing a disconnected hostname', async () => {
    const claim = vi.fn().mockResolvedValue({ count: 0 })
    const database = {
      domainConnection: {
        findUnique: vi.fn().mockResolvedValue({ ...row(), state: 'DISCONNECTED', cloudflareId: null, dokployId: null }),
        count: vi.fn().mockResolvedValue(0),
        updateMany: claim,
      },
    } as unknown as NonNullable<Parameters<typeof reserveDomainConnection>[3]>
    await expect(reserveDomainConnection('next', 'blog.example.com', 'fresh', database)).rejects.toThrow(
      'DOMAIN_RESERVED',
    )
    expect(claim).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ state: 'DISCONNECTED', clientSiteId: 's1', challenge: 'fixture' }),
      }),
    )
  })
  it('rechecks tenant ownership after acquiring the lease before any provider operation', async () => {
    await expect(reconcileDomainConnection('c1', 'former-tenant')).rejects.toThrow('DOMAIN_RESERVED')
    expect(mocks.cf).not.toHaveBeenCalled()
    expect(mocks.find).not.toHaveBeenCalled()
  })
  it('supports proxied DNS only when ownership, provider activation and signed HTTPS routing succeed', async () => {
    await expect(reconcileDomainConnection('c1')).resolves.toMatchObject({ ready: true, state: 'READY' })
    expect(mocks.probe).toHaveBeenCalledWith('blog.example.com', 'probe')
  })
  it('never provisions before TXT ownership is proven', async () => {
    dns.mockResolvedValue({ ownershipVerified: false, dnsStatus: { txt: 0 } })
    await expect(reconcileDomainConnection('c1')).resolves.toMatchObject({ ready: false, state: 'OWNERSHIP' })
    expect(mocks.cf).not.toHaveBeenCalled()
    expect(mocks.find).not.toHaveBeenCalled()
  })
  it('distinguishes temporary resolver failure from a missing ownership record', async () => {
    dns.mockResolvedValue({ ownershipVerified: false, dnsStatus: { txt: 2 } })
    await expect(reconcileDomainConnection('c1')).resolves.toMatchObject({ ready: false, transient: true })
  })
  it('does not activate merely because Cloudflare is active', async () => {
    mocks.probe.mockResolvedValue(false)
    await expect(reconcileDomainConnection('c1')).resolves.toMatchObject({ ready: false, state: 'ROUTING' })
  })
  it('does not take over an untracked provider router', async () => {
    mocks.find.mockResolvedValue({ domainId: 'manual-router' })
    await expect(reconcileDomainConnection('c1')).resolves.toMatchObject({ ready: false })
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ errorCode: 'ADOPTION_REQUIRED' }) }),
    )
    expect(mocks.dokploy).not.toHaveBeenCalled()
  })
  it('does not run overlapping reconciliation', async () => {
    updateMany.mockResolvedValueOnce({ count: 0 })
    await expect(withDomainLease('c1', async () => true)).rejects.toThrow('BUSY')
    expect(record).not.toHaveBeenCalled()
  })
  it('does not delete externally managed resources when disconnecting', async () => {
    record.mockResolvedValue({
      ...row(),
      cleanupRequestedAt: new Date(),
      cloudflareManaged: false,
      dokployManaged: false,
    })
    await expect(reconcileDomainConnection('c1')).resolves.toMatchObject({ state: 'DISCONNECTED' })
    expect(mocks.cf).not.toHaveBeenCalled()
    expect(mocks.find).not.toHaveBeenCalled()
    expect(mocks.dokploy).not.toHaveBeenCalled()
  })
  it('refuses to delete a provider object with a different hostname', async () => {
    record.mockResolvedValue({ ...row(), cleanupRequestedAt: new Date() })
    mocks.cf.mockResolvedValue({ id: 'cf1', hostname: 'other.example.com' })
    await reconcileDomainConnection('c1')
    expect(mocks.cf).toHaveBeenCalledTimes(1)
    expect(mocks.dokploy).not.toHaveBeenCalled()
  })
  it('marks stale setup for cleanup rather than provisioning it', async () => {
    site.mockResolvedValue({ domain: 'another.topiqu.com', pendingDomain: null, plan: 'PRO' })
    await expect(reconcileDomainConnection('c1')).resolves.toMatchObject({ state: 'DISCONNECTING' })
    expect(mocks.cf).not.toHaveBeenCalled()
  })
  it('does not delete a certificate replaced with another connection identity', async () => {
    record.mockResolvedValue({
      ...row(),
      cleanupRequestedAt: new Date(),
      cloudflareId: null,
      dokployId: null,
      certificateId: 'cert1',
    })
    mocks.dokploy.mockResolvedValue({ name: 'unrelated', organizationId: 'org' })
    await reconcileDomainConnection('c1')
    expect(mocks.dokploy).toHaveBeenCalledExactlyOnceWith('certificates.one', 'GET', { certificateId: 'cert1' })
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ errorCode: 'PROVIDER_CONFLICT' }) }),
    )
  })
})

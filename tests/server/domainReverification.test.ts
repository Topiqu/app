import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const reconcile = vi.hoisted(() => vi.fn())
vi.mock('../../server/utils/domains/connections', () => ({ reconcileDomainConnection: reconcile }))
vi.mock('../../server/utils/domains/notifications', () => ({ domainAdminNotifications: async () => [] }))
vi.mock('../../server/utils/domains/fallback', () => ({ chooseDomainFallback: async () => 'fallback.topiqu.com' }))

const update = vi.fn()
const dns = vi.fn()
const cache = vi.fn()
const connectionUpdate = vi.fn()
const site = {
  id: 's1',
  domain: 'blog.example.com',
  domainVerificationToken: 'fixture',
  domainVerificationStatus: 'VERIFIED',
  domainVerificationFailures: 2,
  domainVerificationDegradedAt: null,
}
const database = {
  domainConnection: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: connectionUpdate },
  clientSite: { findMany: vi.fn(), updateMany: update },
  domainRedirect: { findMany: vi.fn(), deleteMany: vi.fn() },
  notification: { createMany: vi.fn() },
}

beforeEach(() => {
  vi.clearAllMocks()
  database.domainConnection.findMany.mockResolvedValue([])
  database.domainConnection.findUnique.mockResolvedValue({ id: 'c1' })
  database.clientSite.findMany.mockResolvedValue([site])
  database.domainRedirect.findMany.mockResolvedValue([{ host: 'fallback.topiqu.com' }])
  update.mockResolvedValue({ count: 1 })
  connectionUpdate.mockResolvedValue({ count: 1 })
  dns.mockResolvedValue({
    ownershipVerified: false,
    routingVerified: false,
    dnsStatus: { txt: 0, cname: 0 },
    error: null,
  })
  reconcile.mockResolvedValue({ ready: false, state: 'OWNERSHIP' })
  vi.stubGlobal('defineMonitoredTask', (task: unknown) => task)
  vi.stubGlobal('prisma', { ...database, $transaction: (task: (tx: typeof database) => unknown) => task(database) })
  vi.stubGlobal('checkDomainDns', dns)
  vi.stubGlobal('uncache', cache)
  vi.stubGlobal('tenantHostKey', (host: string) => `host:${host}`)
  vi.stubGlobal('domainRedirectKey', (host: string) => `redirect:${host}`)
  vi.stubGlobal('logAction', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())
const run = async () => {
  const task = (await import('../../server/tasks/domain-reverification')).default as unknown as {
    run: () => Promise<unknown>
  }
  return task.run()
}

describe('scheduled domain verification', () => {
  it('suspends serving after repeated confirmed lost TXT proof, restores fallback and queues cleanup', async () => {
    await run()
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          domain: 'fallback.topiqu.com',
          domainVerified: true,
          domainVerificationToken: null,
        }),
      }),
    )
    expect(connectionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: 'DISCONNECTING' }) }),
    )
    expect(cache).toHaveBeenCalledWith('host:blog.example.com', 'redirect:blog.example.com')
    expect(cache).toHaveBeenCalledWith('host:fallback.topiqu.com', 'redirect:fallback.topiqu.com')
  })
  it('does not revoke ownership for a resolver outage', async () => {
    dns.mockResolvedValue({ ownershipVerified: false, dnsStatus: { txt: 2 }, error: 'TXT_DNS_STATUS_2' })
    reconcile.mockResolvedValue({ ready: false, transient: true, state: 'DNS_UNAVAILABLE' })
    await run()
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0]![0].data).not.toHaveProperty('domainVerified')
    expect(connectionUpdate).not.toHaveBeenCalled()
  })
  it('retains the routing grace period when ownership is still proven', async () => {
    dns.mockResolvedValue({ ownershipVerified: true, routingVerified: false, dnsStatus: { txt: 0 }, error: null })
    reconcile.mockResolvedValue({ ready: false, state: 'ROUTING' })
    await run()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ domainVerified: true, domainVerificationStatus: 'DEGRADED' }),
      }),
    )
    expect(connectionUpdate).not.toHaveBeenCalled()
  })
})

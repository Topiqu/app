import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DatabaseTransaction } from '../../server/utils/database'

import { retireUnpaidCustomDomains } from '../../server/utils/domains/entitlement'

const site = vi.fn()
const update = vi.fn()
const updateMany = vi.fn()
const redirects = vi.fn()
const cleanup = vi.fn()
const fallback = vi.fn()
const tx = {
  clientSite: { findUniqueOrThrow: site, update, updateMany },
  domainRedirect: { deleteMany: redirects },
  domainConnection: { updateMany: cleanup },
}
const retire = () => retireUnpaidCustomDomains(tx as unknown as DatabaseTransaction, 'blog')
beforeEach(() => {
  vi.clearAllMocks()
  site.mockResolvedValue({ domain: 'custom.example.com', pendingDomain: 'another.example.com' })
  fallback.mockResolvedValue('original.topiqu.com')
  vi.stubGlobal('chooseDomainFallback', fallback)
  vi.stubGlobal('isManagedDomain', (host: string) => host.endsWith('.topiqu.com'))
})
afterEach(() => vi.unstubAllGlobals())

describe('custom domain entitlement retirement', () => {
  it('switches canonical host and cancels pending activation inside the downgrade transaction', async () => {
    await retire()
    expect(fallback).toHaveBeenCalledWith('blog', tx)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          domain: 'original.topiqu.com',
          domainVerified: true,
          domainVerificationToken: null,
        }),
      }),
    )
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { pendingDomain: null, pendingDomainToken: null, pendingDomainRequestedAt: null },
      }),
    )
    expect(redirects).toHaveBeenCalledWith({
      where: { clientSiteId: 'blog', host: { in: ['custom.example.com', 'original.topiqu.com'] } },
    })
  })
  it('queues durable provider cleanup without clearing leases, certificates or resource IDs', async () => {
    await retire()
    expect(cleanup).toHaveBeenCalledWith({
      where: { clientSiteId: 'blog', state: { not: 'DISCONNECTED' }, cleanupRequestedAt: null },
      data: { state: 'DISCONNECTING', cleanupRequestedAt: expect.any(Date) },
    })
  })
  it('cancels a pending custom domain even if the current domain is free', async () => {
    site.mockResolvedValue({ domain: 'original.topiqu.com', pendingDomain: 'another.example.com' })
    await retire()
    expect(update).not.toHaveBeenCalled()
    expect(updateMany).toHaveBeenCalledOnce()
    expect(cleanup).toHaveBeenCalledOnce()
  })
  it('leaves free managed domains and managed address changes available on Basic', async () => {
    site.mockResolvedValue({ domain: 'original.topiqu.com', pendingDomain: 'new.topiqu.com' })
    await retire()
    expect(fallback).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(updateMany).not.toHaveBeenCalled()
  })
  it('fails the whole downgrade transaction if a safe fallback cannot be selected', async () => {
    fallback.mockRejectedValueOnce(new Error('DOMAIN_FALLBACK_UNAVAILABLE'))
    await expect(retire()).rejects.toThrow('DOMAIN_FALLBACK_UNAVAILABLE')
    expect(update).not.toHaveBeenCalled()
    expect(cleanup).not.toHaveBeenCalled()
  })
})

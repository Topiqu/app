import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { chooseDomainFallback } from '../../server/utils/domains/fallback'

const taken = vi.hoisted(() => vi.fn())
vi.mock('../../server/utils/domainVerification', () => ({ isDomainTaken: taken }))

const aliases = vi.fn()
beforeEach(() => {
  vi.stubEnv('BASE_DOMAIN', 'topiqu.com')
  vi.stubGlobal('prisma', { domainRedirect: { findMany: aliases } })
  taken.mockReset().mockResolvedValue(false)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('revoked domain fallback', () => {
  it('reuses an available managed alias, excluding custom and other tenant addresses', async () => {
    aliases.mockResolvedValue([{ host: 'custom.example.com' }, { host: 'old.topiqu.com' }, { host: 'own.topiqu.com' }])
    taken.mockImplementation(async (host: string) => host === 'old.topiqu.com')
    await expect(chooseDomainFallback('site')).resolves.toBe('own.topiqu.com')
  })
  it('creates a managed address when the blog has no former alias', async () => {
    aliases.mockResolvedValue([])
    await expect(chooseDomainFallback('site')).resolves.toMatch(/^blog-[a-f0-9]{24}\.topiqu\.com$/)
  })
  it('fails without changing data when no candidate is available', async () => {
    aliases.mockResolvedValue([])
    taken.mockResolvedValue(true)
    await expect(chooseDomainFallback('site')).rejects.toThrow('DOMAIN_FALLBACK_UNAVAILABLE')
    expect(taken).toHaveBeenCalledTimes(5)
  })
})

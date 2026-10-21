import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { requireDomainAccess } from '../../server/utils/domainVerification'

const host = vi.fn()
const tenant = vi.fn()
const origin = vi.fn()
beforeEach(() => {
  host.mockReturnValue(null)
  tenant.mockResolvedValue(null)
  origin.mockReturnValue(undefined)
  vi.stubGlobal('requireDb', async () => ({ user: { role: 'admin', clientSiteId: 'own' }, db: {} }))
  vi.stubGlobal('requireTenantScope', vi.fn())
  vi.stubGlobal('tenantHostname', host)
  vi.stubGlobal('cachedTenantByHost', tenant)
  vi.stubGlobal('getRequestHeader', origin)
  vi.stubGlobal('getRequestURL', () => new URL('https://app.topiqu.com/api/domain'))
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('createError', createError)
})
afterEach(() => vi.unstubAllGlobals())

describe('domain management host boundaries', () => {
  it('allows authorized management from the platform host', async () => {
    await expect(requireDomainAccess({} as never)).resolves.toMatchObject({ clientSiteId: 'own' })
  })
  it('rejects another tenant hostname and unresolved publication hosts', async () => {
    host.mockReturnValue('other.topiqu.com')
    tenant.mockResolvedValue({ id: 'other' })
    await expect(requireDomainAccess({} as never)).rejects.toMatchObject({ statusCode: 403 })
    tenant.mockResolvedValue(null)
    await expect(requireDomainAccess({} as never)).rejects.toMatchObject({ statusCode: 403 })
  })
  it('rejects cross-origin cookie requests even between sibling subdomains', async () => {
    origin.mockReturnValue('https://other.topiqu.com')
    await expect(requireDomainAccess({} as never)).rejects.toMatchObject({ statusCode: 403 })
    origin.mockReturnValue('https://app.topiqu.com')
    await expect(requireDomainAccess({} as never)).resolves.toMatchObject({ clientSiteId: 'own' })
  })
})

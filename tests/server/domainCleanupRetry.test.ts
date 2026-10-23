import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../server/utils/domains/connections'), 'reconcileDomainConnection')
}

const reconcile = vi.hoisted(() => vi.fn())
vi.mock('../../server/utils/domains/connections', () => ({ reconcileDomainConnection: reconcile }))
const find = vi.fn()
const update = vi.fn()
const id = '00000000-0000-4000-8000-000000000001'
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('requireDomainAccess', async () => ({
    clientSiteId: 'own',
    user: { id: 'user' },
    db: {
      clientSite: {
        findUniqueOrThrow: async () => ({ domain: 'fallback.topiqu.com', pendingDomain: null }),
        updateMany: update,
      },
      domainConnection: { findUnique: find },
    },
  }))
  vi.stubGlobal('consumeRateLimit', async () => true)
  vi.stubGlobal('readValidatedBody', async () => ({ connectionId: id }))
  vi.stubGlobal('createError', createError)
  find.mockResolvedValue({ id, host: 'old.example.com', state: 'DISCONNECTING', cleanupRequestedAt: new Date() })
  reconcile.mockResolvedValue({ ready: false, state: 'DISCONNECTED' })
})
afterEach(() => vi.unstubAllGlobals())
const refresh = async () => {
  const handler = (await import('../../server/api/domain/refresh.post')).default as unknown as (
    event: unknown,
  ) => Promise<unknown>
  return handler({})
}
describe('scoped cleanup retry', () => {
  it('retries a retired connection after the blog has switched to a managed fallback', async () => {
    await expect(refresh()).resolves.toMatchObject({ state: 'DISCONNECTED' })
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ where: { id, clientSiteId: 'own' } }))
    expect(reconcile).toHaveBeenCalledWith(id, 'own')
    expect(update).not.toHaveBeenCalled()
  })
  it('does not reconcile a connection outside the tenant scope', async () => {
    find.mockResolvedValue(null)
    await expect(refresh()).rejects.toMatchObject({ statusCode: 409 })
    expect(reconcile).not.toHaveBeenCalled()
  })
  it('rejects a retired connection that has not been queued for cleanup', async () => {
    find.mockResolvedValue({ id, host: 'old.example.com', state: 'READY', cleanupRequestedAt: null })
    await expect(refresh()).rejects.toMatchObject({ statusCode: 409 })
    expect(reconcile).not.toHaveBeenCalled()
  })
})

beforeEach(stubImports)

import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const rawBody = vi.hoisted(() => vi.fn())
vi.mock('../../server/utils/domains/request', () => ({ readDomainBody: rawBody }))

const guard = vi.fn()
const lookup = vi.fn()
const body = { connectionId: '00000000-0000-4000-8000-000000000001', certificate: 'fixture', privateKey: 'fixture' }
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('requireDomainAccess', guard)
  vi.stubGlobal('consumeRateLimit', async () => true)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('readValidatedBody', async () => body)
  rawBody.mockResolvedValue(body)
  lookup.mockResolvedValue(null)
  guard.mockResolvedValue({
    user: { role: 'admin' },
    clientSiteId: 'own-tenant',
    db: { domainConnection: { findUnique: lookup } },
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('domain mutation authorization', () => {
  it.each(['adopt.post', 'certificate.post', 'disconnect.post', 'refresh.post', 'pending.post', 'pending.delete'])(
    'rejects unauthenticated requests before processing %s',
    async (route) => {
      guard.mockRejectedValue(createError({ statusCode: 401 }))
      const handler = (await import(`../../server/api/domain/${route}.ts`)).default as (
        event: unknown,
      ) => Promise<unknown>
      await expect(handler({})).rejects.toMatchObject({ statusCode: 401 })
      expect(rawBody).not.toHaveBeenCalled()
      expect(lookup).not.toHaveBeenCalled()
    },
  )
  it('does not allow a tenant admin to attach manual infrastructure', async () => {
    const handler = (await import('../../server/api/domain/adopt.post')).default as unknown as (
      event: unknown,
    ) => Promise<unknown>
    await expect(handler({})).rejects.toMatchObject({ statusCode: 403 })
    expect(lookup).not.toHaveBeenCalled()
  })
  it('constrains certificate imports to the active tenant before touching a private key', async () => {
    const handler = (await import('../../server/api/domain/certificate.post')).default as unknown as (
      event: unknown,
    ) => Promise<unknown>
    await expect(handler({})).rejects.toMatchObject({ statusCode: 404 })
    expect(lookup).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: body.connectionId, clientSiteId: 'own-tenant' } }),
    )
  })
})

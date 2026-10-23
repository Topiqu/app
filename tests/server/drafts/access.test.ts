import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { findMany, count } = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn() }))
vi.mock('../../../server/utils/prisma', () => ({ default: { draftPost: { findMany, count } } }))

const user = { id: 'editor', role: 'admin', clientSiteId: 'tenant-1' }
const db = { draftPost: { findMany, count } }
const scope = vi.fn()
let query: Record<string, unknown>

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  query = {}
  findMany.mockResolvedValue([])
  count.mockResolvedValue(0)
  scope.mockResolvedValue({ user, membership: { clientSiteId: 'tenant-1' } })
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getQuery', () => query)
  vi.stubGlobal('getValidatedQuery', async (_event: unknown, parse: (value: unknown) => unknown) => parse(query))
  vi.stubGlobal('requireTenantScope', scope)
  vi.stubGlobal('getEnhancedPrisma', async () => db)
})
afterEach(() => vi.unstubAllGlobals())

describe('LinkedIn workflow draft listing', () => {
  it('rejects an anonymous request before reading any draft', async () => {
    scope.mockRejectedValue(createError({ statusCode: 401 }))
    const handler = (await import('../../../server/api/drafts/index.get')).default
    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 401 })
    expect(findMany).not.toHaveBeenCalled()
  })

  it('requires integration access and an active tenant even for an elevated actor', async () => {
    scope.mockResolvedValue({ user: { ...user, role: 'superadmin' }, membership: {} })
    const handler = (await import('../../../server/api/drafts/index.get')).default
    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 403 })
    expect(scope).toHaveBeenCalledWith(expect.anything(), 'INTEGRATION_CONTROL')
    expect(findMany).not.toHaveBeenCalled()
  })

  it('bounds and filters the active tenant queue without selecting company credentials', async () => {
    query = { page: '2', limit: '10', status: 'AWAITING_APPROVAL' }
    findMany.mockResolvedValue([{ id: 'draft-1', policyFlags: ['Review needed', null, 1] }])
    count.mockResolvedValue(21)
    const handler = (await import('../../../server/api/drafts/index.get')).default
    const result = await handler({} as never)
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: expect.objectContaining({
          status: 'AWAITING_APPROVAL',
          task: { deletedAt: null, company: { clientSiteId: 'tenant-1', deletedAt: null } },
        }),
        select: expect.objectContaining({
          task: { select: { topic: true, company: { select: { name: true } } } },
        }),
      }),
    )
    expect(result).toMatchObject({
      drafts: [{ id: 'draft-1', policyFlags: ['Review needed'] }],
      total: 21,
      page: 2,
      pageSize: 10,
    })
  })

  it.each([{ status: 'not-a-status' }, { limit: 101 }, { page: -1 }])(
    'rejects an invalid filter %j before reading',
    async (invalid) => {
      query = invalid
      const handler = (await import('../../../server/api/drafts/index.get')).default
      await expect(handler({} as never)).rejects.toThrow()
      expect(findMany).not.toHaveBeenCalled()
    },
  )
})

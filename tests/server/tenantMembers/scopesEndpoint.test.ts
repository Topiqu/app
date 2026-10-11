import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TENANT_SCOPES } from '../../../server/utils/tenantMembership'

afterEach(() => vi.unstubAllGlobals())
beforeEach(() => vi.resetModules())

const setup = async (scopes: string[], currentScopes = ['ARTICLE_WRITE', 'AI_USE']) => {
  const update = vi.fn().mockResolvedValue({ id: 'member-2', scopes: [...new Set(scopes)] })
  const log = vi.fn()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('TENANT_SCOPES', TENANT_SCOPES)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('requireTenantScope', async () => ({
    user: { id: 'owner-1' },
    membership: { id: 'member-1', clientSiteId: 'tenant-1' },
  }))
  vi.stubGlobal('getRouterParam', () => 'member-2')
  vi.stubGlobal('getIp', () => '203.0.113.4')
  vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (value: unknown) => unknown) => parse({ scopes }))
  vi.stubGlobal('prisma', {
    tenantMembership: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: 'member-2', userId: 'author-1', role: 'MEMBER', scopes: currentScopes }),
      update,
    },
  })
  vi.stubGlobal('logAction', log)
  const handler = (await import('../../../server/api/tenant/members/[id].patch')).default
  return { run: () => handler({} as never), update, log }
}

describe('tenant scope change audit', () => {
  it('records the actor, target and exact permissions added and removed', async () => {
    const { run, log } = await setup(['ARTICLE_WRITE', 'ARTICLE_PUBLISH', 'ARTICLE_PUBLISH'])
    await run()
    expect(log).toHaveBeenCalledWith({
      action: 'TENANT_MEMBER_SCOPES_CHANGED',
      userId: 'owner-1',
      clientSiteId: 'tenant-1',
      ip: '203.0.113.4',
      metadata: {
        membershipId: 'member-2',
        targetUserId: 'author-1',
        previousScopes: ['ARTICLE_WRITE', 'AI_USE'],
        scopes: ['ARTICLE_WRITE', 'ARTICLE_PUBLISH'],
        addedScopes: ['ARTICLE_PUBLISH'],
        removedScopes: ['AI_USE'],
      },
    })
  })

  it('does not report a permission change when only order or duplicates differ', async () => {
    const { run, log, update } = await setup(['AI_USE', 'ARTICLE_WRITE', 'AI_USE'])
    await expect(run()).resolves.toEqual({ id: 'member-2', scopes: ['ARTICLE_WRITE', 'AI_USE'] })
    expect(update).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
  })

  it('records removal of all permissions', async () => {
    const { run, log } = await setup([])
    await run()
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          scopes: [],
          addedScopes: [],
          removedScopes: ['ARTICLE_WRITE', 'AI_USE'],
        }),
      }),
    )
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('DELETE /api/tenant/members/:id', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('getRouterParam', () => 'membership-2')
    vi.stubGlobal('getIp', () => '203.0.113.4')
    vi.stubGlobal('logAction', vi.fn())
    vi.stubGlobal('sendEmail', vi.fn())
    vi.stubGlobal('logger', { error: vi.fn() })
    vi.stubGlobal('requireTenantScope', async () => ({
      user: { id: 'owner-1', name: 'Owner', email: 'owner@example.com' },
      membership: { id: 'membership-1', clientSiteId: 'tenant-1' },
    }))
  })

  it('moves every session that still points at the removed tenant', async () => {
    const sessionUpdate = vi.fn((args) => ({ kind: 'session', args }))
    const transaction = vi.fn().mockResolvedValue([])
    const email = vi.fn()
    vi.stubGlobal('sendEmail', email)
    vi.stubGlobal('prisma', {
      tenantMembership: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({ id: 'membership-2', userId: 'member-1', role: 'MEMBER', scopes: [] })
          .mockResolvedValueOnce({ clientSiteId: 'tenant-2' })
          .mockResolvedValueOnce({ user: { email: 'owner@example.com' } }),
        delete: vi.fn((args) => ({ kind: 'membership', args })),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ clientSiteId: 'tenant-1', email: 'member@example.com', language: 'en' }),
        update: vi.fn((args) => ({ kind: 'user', args })),
      },
      session: { updateMany: sessionUpdate },
      clientSite: { findUniqueOrThrow: vi.fn().mockResolvedValue({ name: 'Tenant', logoUrl: null }) },
      $transaction: transaction,
    })

    const handler = (await import('../../../server/api/tenant/members/[id].delete')).default
    await expect(handler({} as never)).resolves.toEqual({ ok: true })
    expect(sessionUpdate).toHaveBeenCalledWith({
      where: { userId: 'member-1', clientSiteId: 'tenant-1' },
      data: { clientSiteId: 'tenant-2' },
    })
    expect(transaction).toHaveBeenCalledOnce()
    expect(email).toHaveBeenCalledWith(expect.objectContaining({
      to: 'member@example.com',
      template: 'tenantMemberRemoved',
      data: expect.objectContaining({ tenantName: 'Tenant', ownerEmail: 'owner@example.com' }),
    }))
  })
})

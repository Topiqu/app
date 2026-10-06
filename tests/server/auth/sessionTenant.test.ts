import { afterEach, describe, expect, it, vi } from 'vitest'

import { initialTenant, toSessionUser, uniqueUsername } from '../../../server/utils/session'

afterEach(() => vi.unstubAllGlobals())

describe('login tenant selection', () => {
  it.each([
    { last: null, home: 'gaming', available: ['gaming', 'test'], expected: 'gaming' },
    { last: 'test', home: 'gaming', available: ['gaming', 'test'], expected: 'test' },
    { last: 'removed', home: 'removed', available: ['test'], expected: 'test' },
    { last: 'removed', home: 'gaming', available: [], expected: null },
  ])('last $last, home $home -> $expected', async ({ last, home, available, expected }) => {
    vi.stubGlobal('prisma', {
      session: { findFirst: vi.fn().mockResolvedValue(last ? { clientSiteId: last } : null) },
      user: { findUnique: vi.fn().mockResolvedValue({ clientSiteId: home }) },
      tenantMembership: {
        findMany: vi.fn().mockResolvedValue(available.map((clientSiteId) => ({ clientSiteId }))),
      },
    })

    expect(await initialTenant('user')).toBe(expected)
  })
})

describe('session user', () => {
  const user = { id: 'u1', name: 'jane', email: 'jane@example.com', image: null, role: 'reader' }

  const stub = (membership: { deletedAt: Date | null; clientSite: { plan: string } } | null) => {
    const update = vi.fn().mockResolvedValue({})
    vi.stubGlobal('prisma', {
      tenantMembership: { findUnique: vi.fn().mockResolvedValue(membership) },
      session: { update },
    })
    return update
  }

  it('makes a member of the active tenant its admin on that tenant’s plan', async () => {
    stub({ deletedAt: null, clientSite: { plan: 'PRO' } })
    expect(await toSessionUser(user, { id: 's1', clientSiteId: 'site' })).toMatchObject({
      role: 'admin',
      clientSiteId: 'site',
      plan: 'PRO',
      sessionId: 's1',
    })
  })

  it('drops a tenant the user was removed from, on the session row too', async () => {
    const update = stub({ deletedAt: new Date(), clientSite: { plan: 'PRO' } })
    expect(await toSessionUser(user, { id: 's1', clientSiteId: 'site' })).toMatchObject({
      role: 'reader',
      clientSiteId: '',
      plan: 'BASIC',
    })
    expect(update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { clientSiteId: null } })
  })

  it('keeps a superadmin a superadmin without a tenant', async () => {
    const update = stub(null)
    expect(await toSessionUser({ ...user, role: 'superadmin' }, { id: 's1', clientSiteId: null })).toMatchObject({
      role: 'superadmin',
      plan: 'BASIC',
    })
    expect(update).not.toHaveBeenCalled()
  })
})

describe('OAuth username', () => {
  const stub = (taken: boolean) =>
    vi.stubGlobal('prisma', { user: { findUnique: vi.fn().mockResolvedValue(taken ? { id: 'x' } : null) } })

  it('uses the provider name when it is free', async () => {
    stub(false)
    expect(await uniqueUsername('Jane Doe', 'jane@example.com')).toBe('Jane Doe')
  })

  it('falls back to the email local part, and to `user` below the 3-character minimum', async () => {
    stub(false)
    expect(await uniqueUsername('', 'jane@example.com')).toBe('jane')
    expect(await uniqueUsername('', 'jo@example.com')).toBe('user')
  })

  it('suffixes a taken name and stays within the 50-character limit', async () => {
    stub(true)
    const name = await uniqueUsername('x'.repeat(80), 'jane@example.com')
    expect(name).toMatch(/^x{36}_\d+$/)
    expect(name.length).toBeLessThanOrEqual(50)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

import { generateSessionToken } from '../../../server/utils/session'

afterEach(() => vi.unstubAllGlobals())

describe('login tenant selection', () => {
  it.each([
    { active: null, preferred: 'gaming', available: ['gaming', 'test'], expected: 'gaming' },
    { active: 'test', preferred: 'gaming', available: ['gaming', 'test'], expected: 'test' },
    { active: 'removed', preferred: 'removed', available: ['test'], expected: 'test' },
    { active: 'removed', preferred: 'gaming', available: [], expected: null },
  ])('resolves an existing session: $active -> $expected', async ({ active, preferred, available, expected }) => {
    const update = vi.fn().mockResolvedValue({})
    vi.stubGlobal('prisma', {
      session: {
        findFirst: vi.fn().mockResolvedValue({ id: 'session', ip: null, clientSiteId: active }),
        update,
      },
      tenantMembership: {
        findMany: vi.fn().mockResolvedValue(available.map((clientSiteId) => ({ clientSiteId }))),
      },
    })

    await generateSessionToken({ id: 'user', clientSiteId: preferred }, { headers: {}, method: 'POST' })

    expect(update).toHaveBeenCalledWith({
      where: { id: 'session' },
      data: { lastUsedAt: expect.any(Date), clientSiteId: expected },
    })
  })
})

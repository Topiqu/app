import { createError } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { requireTenantMember, requireTenantScope } from '../../server/utils/tenantMembership'

const membership = {
  id: 'm-1',
  clientSiteId: 'site-1',
  userId: 'user-1',
  role: 'MEMBER' as const,
  scopes: ['ARTICLE_WRITE' as const],
}

describe('tenant access for API key requests', () => {
  afterEach(() => vi.unstubAllGlobals())

  const event = () => {
    const user = { id: 'user-1', clientSiteId: 'site-1' }
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('requireUser', vi.fn().mockResolvedValue(user))
    vi.stubGlobal('prisma', { tenantMembership: { findUnique: vi.fn() } })
    return { context: { apiKeyMembership: membership } } as never
  }

  it('uses the narrowed membership instead of reading the stored one', async () => {
    const e = event()
    await expect(requireTenantMember(e)).resolves.toEqual({ user: expect.anything(), membership })
    expect((globalThis as unknown as { prisma: any }).prisma.tenantMembership.findUnique).not.toHaveBeenCalled()
  })

  it('never reaches another tenant', async () => {
    await expect(requireTenantMember(event(), 'site-2')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('enforces the narrowed scopes, so an owner key without PUBLISH cannot publish', async () => {
    await expect(requireTenantScope(event(), 'ARTICLE_WRITE')).resolves.toBeTruthy()
    await expect(requireTenantScope(event(), 'ARTICLE_PUBLISH')).rejects.toMatchObject({ statusCode: 403 })
  })
})

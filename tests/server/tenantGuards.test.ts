import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { requireArticleAccess, requireTenantMember, requireTenantScope } from '../../server/utils/tenantMembership'

type Membership = {
  role: 'OWNER' | 'MEMBER'
  scopes: string[]
  deletedAt?: Date | null
  clientSite?: { deletedAt: Date | null }
}

const event = {} as never

const stub = (
  user: { id: string; role: string; clientSiteId: string },
  membership: Membership | null,
  article?: { userId: string; clientSiteId: string } | null,
) => {
  const findUnique = vi.fn(
    async ({ where }: { where: { clientSiteId_userId: { clientSiteId: string; userId: string } } }) =>
      membership && {
        id: 'm1',
        clientSiteId: where.clientSiteId_userId.clientSiteId,
        userId: where.clientSiteId_userId.userId,
        deletedAt: null,
        clientSite: { deletedAt: null },
        ...membership,
      },
  )
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('requireUser', async () => user)
  vi.stubGlobal('prisma', {
    tenantMembership: { findUnique },
    article: { findUnique: vi.fn(async () => article ?? null) },
  })
  return { findUnique }
}

const member = { id: 'u1', role: 'admin', clientSiteId: 'site-1' }

beforeEach(() => vi.unstubAllGlobals())
afterEach(() => vi.unstubAllGlobals())

describe('requireTenantMember', () => {
  it('rejects an otherwise active member of a deactivated tenant', async () => {
    stub(member, { role: 'OWNER', scopes: [], clientSite: { deletedAt: new Date() } })
    await expect(requireTenantMember(event)).rejects.toMatchObject({ statusCode: 403 })
  })
  it('rejects a user without an active tenant', async () => {
    stub({ ...member, clientSiteId: '' }, null)
    await expect(requireTenantMember(event)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('rejects a removed membership', async () => {
    stub(member, { role: 'MEMBER', scopes: ['ARTICLE_WRITE'], deletedAt: new Date() })
    await expect(requireTenantMember(event)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('looks up the membership of the requested tenant, not the active one', async () => {
    const { findUnique } = stub(member, { role: 'MEMBER', scopes: [] })
    await requireTenantMember(event, 'site-2')
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientSiteId_userId: { clientSiteId: 'site-2', userId: 'u1' } } }),
    )
  })

  it('gives a superadmin every scope without a database lookup', async () => {
    const { findUnique } = stub({ ...member, role: 'superadmin' }, null)
    const { membership } = await requireTenantMember(event)
    expect(membership.role).toBe('OWNER')
    expect(findUnique).not.toHaveBeenCalled()
  })
})

describe('requireTenantScope', () => {
  it('rejects a member missing the scope', async () => {
    stub(member, { role: 'MEMBER', scopes: ['ARTICLE_WRITE'] })
    await expect(requireTenantScope(event, 'TENANT_SETTINGS')).rejects.toMatchObject({
      statusCode: 403,
      message: 'Missing tenant scope: TENANT_SETTINGS',
    })
  })

  it('admits a member holding the scope', async () => {
    stub(member, { role: 'MEMBER', scopes: ['TENANT_SETTINGS'] })
    await expect(requireTenantScope(event, 'TENANT_SETTINGS')).resolves.toMatchObject({ user: member })
  })

  it('admits the owner regardless of stored scopes', async () => {
    stub(member, { role: 'OWNER', scopes: [] })
    await expect(requireTenantScope(event, 'BILLING_CHANGE')).resolves.toBeTruthy()
  })
})

describe('requireArticleAccess', () => {
  it('returns 404 for an unknown article', async () => {
    stub(member, { role: 'MEMBER', scopes: ['ARTICLE_WRITE'] }, null)
    await expect(requireArticleAccess(event, 'a1')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('checks the scope on the article’s tenant', async () => {
    const { findUnique } = stub(
      member,
      { role: 'MEMBER', scopes: ['ARTICLE_WRITE'] },
      {
        userId: 'u1',
        clientSiteId: 'site-2',
      },
    )
    await requireArticleAccess(event, 'a1')
    expect(findUnique.mock.calls[0]![0].where.clientSiteId_userId.clientSiteId).toBe('site-2')
  })

  it('lets an author edit their own article with ARTICLE_WRITE', async () => {
    stub(member, { role: 'MEMBER', scopes: ['ARTICLE_WRITE'] }, { userId: 'u1', clientSiteId: 'site-1' })
    await expect(requireArticleAccess(event, 'a1')).resolves.toMatchObject({ article: { userId: 'u1' } })
  })

  it('needs ARTICLE_WRITE_OTHERS for a colleague’s article', async () => {
    stub(member, { role: 'MEMBER', scopes: ['ARTICLE_WRITE'] }, { userId: 'u2', clientSiteId: 'site-1' })
    await expect(requireArticleAccess(event, 'a1')).rejects.toMatchObject({
      message: 'Missing tenant scope: ARTICLE_WRITE_OTHERS',
    })
  })

  it('needs ARTICLE_WRITE even for one’s own article', async () => {
    stub(member, { role: 'MEMBER', scopes: ['ARTICLE_WRITE_OTHERS'] }, { userId: 'u1', clientSiteId: 'site-1' })
    await expect(requireArticleAccess(event, 'a1')).rejects.toMatchObject({
      message: 'Missing tenant scope: ARTICLE_WRITE',
    })
  })
})

import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { hasArticleAdminAccess, sessionTenantId } from '../../../server/utils/articleViewerAccess'

const endpoint = readFileSync(resolve(process.cwd(), 'server/api/articles/[id]/index.get.ts'), 'utf8')

describe('article viewer tenant access', () => {
  it('treats an admin from another tenant as a public reader', () => {
    const viewer = { role: 'admin', clientSiteId: 'tenant-a' }

    expect(sessionTenantId(viewer)).toBe('tenant-a')
    expect(hasArticleAdminAccess(viewer, 'tenant-b')).toBe(false)
  })

  it('grants admin fields inside the active tenant', () => {
    expect(hasArticleAdminAccess({ role: 'admin', clientSiteId: 'tenant-a' }, 'tenant-a')).toBe(true)
  })

  it('keeps superadmin access cross-tenant', () => {
    expect(hasArticleAdminAccess({ role: 'superadmin', clientSiteId: 'tenant-a' }, 'tenant-b')).toBe(true)
  })

  it('does not infer a tenant from a public reader session', () => {
    expect(sessionTenantId({ role: 'user', clientSiteId: 'tenant-a' })).toBeUndefined()
  })

  it('uses tenant-scoped admin access in the public article endpoint', () => {
    expect(endpoint).toContain('const clientSiteId = requestedClientSiteId || sessionTenantId(user)')
    expect(endpoint).toContain('const isAdmin = hasArticleAdminAccess(user, clientSiteId)')
    expect(endpoint).not.toContain('clientSiteId !== user.clientSiteId')
  })
})

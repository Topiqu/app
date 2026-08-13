import { describe, expect, it } from 'vitest'

import { assertArticleAdminAccess } from '../../server/utils/articleAdminAccess'

const messages = { unauthorized: 'unauthorized', forbidden: 'forbidden' }
const article = { clientSiteId: 'tenant-a' }

describe('article editor tenant access', () => {
  it('allows an admin only for their tenant', () => {
    expect(() => assertArticleAdminAccess({ role: 'admin', clientSiteId: 'tenant-a' }, article, messages)).not.toThrow()
    expect(() => assertArticleAdminAccess({ role: 'admin', clientSiteId: 'tenant-b' }, article, messages)).toThrowError(
      expect.objectContaining({ statusCode: 403 }),
    )
  })

  it('distinguishes unauthenticated access and permits superadmins', () => {
    expect(() => assertArticleAdminAccess(null, article, messages)).toThrowError(
      expect.objectContaining({ statusCode: 401 }),
    )
    expect(() => assertArticleAdminAccess({ role: 'superadmin' }, article, messages)).not.toThrow()
  })
})

import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const UNAUTHENTICATED_CLIENT_SITE_ROUTES = [
  'server/api/clients/slug/[slug].ts',
  'server/api/clients/[id]/by-userid.get.ts',
]

describe('client site routes reachable without a session', () => {
  it.each(UNAUTHENTICATED_CLIENT_SITE_ROUTES)('%s projects through the public whitelist', (path) => {
    const code = source(path)

    expect(code).toContain('publicClientSiteSelect')
    expect(code).toMatch(/select:\s*publicClientSiteSelect|select:\s*\{[\s\S]*publicClientSiteSelect/)
  })
})

describe('client site routes behind a session', () => {
  it('scopes the client list to superadmins', () => {
    expect(source('server/api/clients/index.get.ts')).toContain("role: 'superadmin'")
  })

  it('pins the client detail route to the caller own tenant unless superadmin', () => {
    const code = source('server/api/clients/[id]/index.get.ts')

    expect(code).toContain('requireTenantMember(event, id)')
  })

  it('returns the complete editable brand kit to tenant settings', () => {
    const code = source('server/api/clients/[id]/index.get.ts')

    for (const field of ['tagline', 'faviconUrl', 'typographyPreset']) {
      expect(code).toContain(`${field}: clientSite.${field}`)
    }
  })

  it('derives the owner status route from the session, never from a route param', () => {
    const code = source('server/api/clients/status.get.ts')

    expect(code).toContain('user.clientSiteId')
    expect(code).not.toContain('getRouterParam')
  })
})

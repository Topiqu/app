import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { invitationEmail, invitationToken, invitationTokenHash, invitationUrl } from '../../server/utils/tenantInvitation'
import { resolveAuthRedirect } from '../../app/utils/authRedirect'
import { hasTenantScope, TENANT_SCOPES } from '../../server/utils/tenantMembership'

describe('tenant invitations', () => {
  it('generates a locale-prefixed URL that works on a cold page load', () => {
    vi.stubGlobal('getRequestURL', () => new URL('https://tenant.topiqu.com/api/tenant/invitations'))
    expect(invitationUrl({} as never, 'raw-token', 'cs')).toBe('https://tenant.topiqu.com/cs/invitation/raw-token')
  })

  it('normalizes invited email addresses', () => {
    expect(invitationEmail('  Member@Example.COM ')).toBe('member@example.com')
  })

  it('creates high-entropy tokens and stores only deterministic hashes', () => {
    const first = invitationToken()
    const second = invitationToken()
    expect(first).not.toBe(second)
    expect(first.length).toBeGreaterThanOrEqual(40)
    expect(invitationTokenHash(first)).toMatch(/^[a-f0-9]{64}$/)
    expect(invitationTokenHash(first)).toBe(invitationTokenHash(first))
    expect(invitationTokenHash(first)).not.toContain(first)
  })
})

describe('tenant authorization', () => {
  it('gives owners every scope without duplicating policy data', () => {
    expect(hasTenantScope({ role: 'OWNER', scopes: [] }, 'BILLING_CHANGE')).toBe(true)
  })

  it('limits members to explicitly granted scopes', () => {
    const member = { role: 'MEMBER' as const, scopes: ['ARTICLE_WRITE' as const] }
    expect(hasTenantScope(member, 'ARTICLE_WRITE')).toBe(true)
    expect(hasTenantScope(member, 'ARTICLE_WRITE_OTHERS')).toBe(false)
  })

  it('keeps the scope catalog unique', () => {
    expect(new Set(TENANT_SCOPES).size).toBe(TENANT_SCOPES.length)
  })

  it('enforces one owner and tenant-scoped uniqueness in the migration', () => {
    const sql = readFileSync(resolve(process.cwd(), 'prisma/migrations/20260813130000_tenant_memberships/migration.sql'), 'utf8')
    expect(sql).toContain('"TenantMembership_one_owner"')
    expect(sql).toContain('"TenantMembership_clientSiteId_userId_key"')
    expect(sql).toContain('WHERE "role" = \'OWNER\'')
  })
})

describe('tenant audit trail', () => {
  it('records every membership and invitation lifecycle mutation', () => {
    const files = [
      'server/api/tenant/invitations.post.ts',
      'server/api/tenant/invitations/[id].delete.ts',
      'server/api/tenant/invitations/[id]/resend.post.ts',
      'server/api/invitations/[token].post.ts',
      'server/api/tenant/members/[id].patch.ts',
      'server/api/tenant/members/[id].delete.ts',
      'server/api/tenant/active.post.ts',
    ].map((file) => readFileSync(resolve(process.cwd(), file), 'utf8')).join('\n')

    for (const action of [
      'TENANT_INVITATION_CREATED',
      'TENANT_INVITATION_RESENT',
      'TENANT_INVITATION_REVOKED',
      'TENANT_INVITATION_ACCEPTED',
      'TENANT_INVITATION_DECLINED',
      'TENANT_MEMBER_SCOPES_CHANGED',
      'TENANT_MEMBER_REMOVED',
      'ACTIVE_TENANT_CHANGED',
    ]) expect(files).toContain(`action: '${action}'`)
  })
})

describe('tenant boundary wiring', () => {
  const source = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8')

  it('projects tenant secrets only behind their matching scopes', () => {
    const endpoint = source('server/api/clients/[id]/index.get.ts')
    expect(endpoint).toContain("hasTenantScope(membership, 'API_KEY_CONTROL')")
    expect(endpoint).toContain("hasTenantScope(membership, 'BILLING_CHANGE')")
    expect(endpoint).toContain("hasTenantScope(membership, 'INTEGRATION_CONTROL')")
    expect(endpoint).toContain("hasTenantScope(membership, 'AI_USE')")
  })

  it('stores the selected tenant on the active session', () => {
    const endpoint = source('server/api/tenant/active.post.ts')
    expect(endpoint).toContain('prisma.session.update')
    expect(endpoint).not.toContain('prisma.user.update')
    expect(source('server/api/auth/[...].ts')).toContain('activeSession?.clientSiteId')
  })

  it('revalidates kicked sessions and protects analytics and tags', () => {
    const auth = source('server/api/auth/[...].ts')
    expect(auth).toContain('prisma.tenantMembership.findUnique')
    expect(auth).toContain("token.role = hasActiveTenant ? 'admin' : 'reader'")
    expect(source('server/api/tenant/members/[id].delete.ts')).toContain('prisma.session.updateMany')
    for (const file of ['server/api/stats/dashboard.ts', 'server/api/stats/views.ts', 'server/api/tags/index.get.ts']) {
      expect(source(file)).toContain('requireTenantScope')
    }
  })

  it('guards integrations, moderation, translations and article tags', () => {
    const expectations = [
      ['server/api/search-console/callback.get.ts', 'INTEGRATION_CONTROL'],
      ['server/api/linkedin/callback.get.ts', 'INTEGRATION_CONTROL'],
      ['server/api/bans/[id]/index.post.ts', 'CONTENT_MODERATE'],
      ['server/api/comments/[id]/index.delete.ts', 'CONTENT_MODERATE'],
      ['server/api/translations/[id]/index.patch.ts', 'requireArticleAccess'],
      ['server/api/articles/[id]/tags/index.post.ts', 'requireArticleAccess'],
    ]
    for (const [file, guard] of expectations) expect(source(file)).toContain(guard)
  })
})

describe('invitation onboarding wiring', () => {
  it('uses the invitation as the OAuth callback instead of the sign-in page', () => {
    expect(resolveAuthRedirect('https://tenant.topiqu.com/en/autorizace?invitation=token', '/en/invitation/token'))
      .toBe('https://tenant.topiqu.com/en/invitation/token')
  })
  const source = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8')

  it('returns distinct states and a useful wrong-account error', () => {
    const endpoint = source('server/api/invitations/[token].post.ts')
    for (const code of ['INVITATION_ACCEPTED', 'INVITATION_REVOKED', 'INVITATION_EXPIRED', 'INVITATION_EMAIL_MISMATCH'])
      expect(endpoint).toContain(code)
    expect(endpoint).toContain('invitedEmail: invitation.email')
  })

  it('returns credentials registration and verification to the invitation', () => {
    const authPage = source('app/pages/autorizace/index.vue')
    const form = source('app/components/Auth/Form.vue')
    expect(authPage).toContain(':redirectTo="invitationRedirect"')
    expect(form.match(/afterSignIn\(user\.role\)/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('keeps the invitation URL as the OAuth callback and accepts the verified OAuth email', () => {
    const form = source('app/components/Auth/Form.vue')
    const auth = source('server/api/auth/[...].ts')
    expect(form).toContain('resolveAuthRedirect(window.location.href, props.redirectTo)')
    expect(form).toContain('callbackUrl: finalRedirectUrl')
    expect(auth).toContain('verifiedGoogleEmail(profile)')
    expect(auth).toContain('verifiedGitHubEmail(emails)')
    expect(source('server/api/invitations/[token].post.ts')).toContain('invitationEmail(user.email) !== invitation.email')
  })
})

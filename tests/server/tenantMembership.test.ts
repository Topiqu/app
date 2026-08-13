import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { invitationEmail, invitationToken, invitationTokenHash } from '../../server/utils/tenantInvitation'
import { hasTenantScope, TENANT_SCOPES } from '../../server/utils/tenantMembership'

describe('tenant invitations', () => {
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

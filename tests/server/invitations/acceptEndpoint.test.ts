import { beforeEach, describe, expect, it, vi } from 'vitest'

const invitation = {
  id: 'invite-1',
  clientSiteId: 'tenant-1',
  invitedById: 'owner-1',
  email: 'member@example.com',
  scopes: ['ARTICLE_WRITE'],
  expiresAt: new Date(Date.now() + 60_000),
  acceptedAt: null,
  revokedAt: null,
}

const loadHandler = async (user: { id: string; email: string; sessionId: string }) => {
  const transaction = vi.fn().mockResolvedValue([])
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('getRouterParam', () => 'raw-token')
  vi.stubGlobal('readValidatedBody', async () => ({ action: 'accept' }))
  vi.stubGlobal('invitationTokenHash', () => 'token-hash')
  vi.stubGlobal('invitationEmail', (email: string) => email.trim().toLowerCase())
  vi.stubGlobal('requireUser', async () => user)
  vi.stubGlobal('getIp', () => '203.0.113.2')
  vi.stubGlobal('logAction', vi.fn())
  vi.stubGlobal('prisma', {
    tenantInvitation: { findUnique: vi.fn().mockResolvedValue(invitation), update: vi.fn((args) => args) },
    tenantMembership: { upsert: vi.fn((args) => args) },
    user: { update: vi.fn((args) => args) },
    session: { update: vi.fn((args) => args) },
    $transaction: transaction,
  })
  const handler = (await import('../../../server/api/invitations/[token].post')).default
  return { handler, transaction }
}

describe('POST /api/invitations/:token', () => {
  beforeEach(() => vi.resetModules())

  it.each(['credentials', 'oauth'])('accepts the invitation after a verified %s sign-in', async () => {
    const { handler, transaction } = await loadHandler({
      id: 'member-1',
      email: 'Member@Example.com',
      sessionId: 'session-1',
    })
    await expect(handler({} as never)).resolves.toEqual({ accepted: true, clientSiteId: 'tenant-1' })
    expect(transaction).toHaveBeenCalledOnce()
    expect(JSON.stringify(transaction.mock.calls[0]?.[0])).toContain('session-1')
  })

  it('rejects a signed-in account with a different email before writing membership', async () => {
    const { handler, transaction } = await loadHandler({
      id: 'wrong-user',
      email: 'other@example.com',
      sessionId: 'session-2',
    })
    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 403,
      data: { code: 'INVITATION_EMAIL_MISMATCH' },
    })
    expect(transaction).not.toHaveBeenCalled()
  })
})

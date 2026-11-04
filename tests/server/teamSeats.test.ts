import { createError } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DatabaseTransaction } from '../../server/utils/database'

import { teamSeatLimit } from '../../shared/utils/teamSeats'
import { activeTeamSeatIds, hasTeamSeat, requireTeamSeatCapacity } from '../../server/utils/teamSeats'

afterEach(() => vi.unstubAllGlobals())

const fixture = (plan = 'PRO', members = 1, invitations = 0) => {
  const calls: string[] = []
  const tx = {
    clientSite: {
      findUnique: vi.fn(async () => ({ paidTeamSeats: null })),
      update: vi.fn(async () => {
        calls.push('lock')
        return { plan }
      }),
    },
    tenantMembership: {
      count: vi.fn(async () => {
        calls.push('members')
        return members
      }),
      findMany: vi.fn(async ({ take }: { take: number }) =>
        [{ id: 'owner' }, { id: 'first' }, { id: 'second' }].slice(0, take),
      ),
    },
    tenantInvitation: {
      count: vi.fn(async () => {
        calls.push('invitations')
        return invitations
      }),
    },
  }
  vi.stubGlobal('createError', createError)
  return { tx, db: tx as unknown as DatabaseTransaction, calls }
}

describe('team seats per blog', () => {
  it('uses the confirmed fixed-plan limits and leaves individually contracted CUSTOM pricing unchanged', () => {
    expect(['BASIC', 'PRO', 'PREMIUM', 'CUSTOM'].map((plan) => teamSeatLimit(plan as 'BASIC'))).toEqual([1, 2, 3, null])
  })
  it('locks the blog before counting seats and reserves pending invitations', async () => {
    const { tx, db, calls } = fixture('PRO', 1, 1)
    await expect(requireTeamSeatCapacity(db, 'blog')).rejects.toMatchObject({
      statusCode: 403,
      data: { code: 'TEAM_SEAT_LIMIT', limit: 2 },
    })
    expect(calls[0]).toBe('lock')
    expect(tx.tenantInvitation.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ acceptedAt: null, revokedAt: null, expiresAt: { gt: expect.any(Date) } }),
      }),
    )
  })
  it('counts the owner, so Basic cannot invite another editor', async () => {
    const { db } = fixture('BASIC', 1)
    await expect(requireTeamSeatCapacity(db, 'blog')).rejects.toMatchObject({ data: { limit: 1 } })
  })
  it('allows an invitation while space remains', async () => {
    const { db } = fixture('PRO', 1)
    await expect(requireTeamSeatCapacity(db, 'blog')).resolves.toBeUndefined()
  })
  it('exchanges the accepted invitation reservation for a membership instead of charging two seats', async () => {
    const { db, tx } = fixture('PRO', 1)
    await requireTeamSeatCapacity(db, 'blog', { invitationId: 'accepted', userId: 'user' })
    expect(tx.tenantInvitation.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { not: 'accepted' } }) }),
    )
    expect(tx.tenantMembership.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: { not: 'user' } }) }),
    )
  })
  it('does not bypass the new limit when accepting an invitation issued before a downgrade', async () => {
    const { db } = fixture('BASIC', 1)
    await expect(requireTeamSeatCapacity(db, 'blog', { invitationId: 'old' })).rejects.toMatchObject({
      statusCode: 403,
    })
  })
  it('allows Premium two colleagues beside the owner and rejects another member at capacity', async () => {
    const { db } = fixture('PREMIUM', 2)
    await expect(requireTeamSeatCapacity(db, 'blog')).resolves.toBeUndefined()
    const full = fixture('PREMIUM', 3)
    await expect(requireTeamSeatCapacity(full.db, 'blog')).rejects.toMatchObject({
      statusCode: 403,
      data: { code: 'TEAM_SEAT_LIMIT', limit: 3 },
    })
  })
  it('keeps the owner and oldest members active, with stable tie-breaking', async () => {
    const { db, tx } = fixture()
    expect(await hasTeamSeat(db, { id: 'newest', clientSiteId: 'blog', role: 'MEMBER' }, 'PRO')).toBe(false)
    expect(await hasTeamSeat(db, { id: 'first', clientSiteId: 'blog', role: 'MEMBER' }, 'PRO')).toBe(true)
    expect(await hasTeamSeat(db, { id: 'second', clientSiteId: 'blog', role: 'MEMBER' }, 'PRO')).toBe(false)
    expect(tx.tenantMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ role: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }], take: 2 }),
    )
    expect(await hasTeamSeat(db, { id: 'second', clientSiteId: 'blog', role: 'MEMBER' }, 'PREMIUM')).toBe(true)
    expect(await hasTeamSeat(db, { id: 'owner', clientSiteId: 'blog', role: 'OWNER' }, 'BASIC')).toBe(true)
  })
  it('does not impose an invented limit or price on CUSTOM', async () => {
    const { db, tx } = fixture('CUSTOM', 1000)
    await requireTeamSeatCapacity(db, 'blog')
    expect(tx.tenantMembership.count).not.toHaveBeenCalled()
    expect(await activeTeamSeatIds(db, 'blog', 'CUSTOM')).toBeNull()
  })
})

import type { DatabaseTransaction } from './database'
import type { ClientPlan, TenantRole } from '../../generated/zenstack/models'

import { teamSeatLimit } from '../../shared/utils/teamSeats'

type SeatDb = Pick<DatabaseTransaction, 'clientSite' | 'tenantMembership' | 'tenantInvitation'>

/** OWNER precedes MEMBER in the PostgreSQL enum. Stable ordering restores the same
 * seats after an upgrade, without deleting memberships or persisting a second entitlement. */
export const activeTeamSeatIds = async (
  db: Pick<SeatDb, 'tenantMembership' | 'clientSite'>,
  clientSiteId: string,
  plan: ClientPlan,
) => {
  const site = await db.clientSite.findUnique({
    where: { id: clientSiteId },
    select: { paidTeamSeats: true, billingAccountId: true },
  })
  // An agency pays per blog, not per seat.
  if (site?.billingAccountId) return null
  const limit = teamSeatLimit(plan, site?.paidTeamSeats)
  if (limit === null) return null
  const members = await db.tenantMembership.findMany({
    where: { clientSiteId, deletedAt: null, user: { deletedAt: null } },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
    take: limit,
  })
  return new Set(members.map(({ id }) => id))
}

export const hasTeamSeat = async (
  db: Pick<SeatDb, 'tenantMembership' | 'clientSite'>,
  membership: { id: string; clientSiteId: string; role: TenantRole },
  plan: ClientPlan,
) =>
  membership.role === 'OWNER' ||
  (await activeTeamSeatIds(db, membership.clientSiteId, plan))?.has(membership.id) !== false

/** Call inside the membership/invitation transaction. Plan changes lock this same
 * row first, so parallel invites and accepts cannot oversell a fixed-plan seat. */
export const requireTeamSeatCapacity = async (
  tx: SeatDb,
  clientSiteId: string,
  exclude: { invitationId?: string; email?: string; userId?: string } = {},
) => {
  const site = await tx.clientSite.update({
    where: { id: clientSiteId, deletedAt: null },
    data: { updatedAt: new Date() },
    select: { plan: true, paidTeamSeats: true, billingLeaseUntil: true, billingAccountId: true },
  })
  if (site.billingLeaseUntil && site.billingLeaseUntil > new Date())
    throw createError({
      statusCode: 409,
      message: 'Billing change in progress',
      data: { code: 'BILLING_CHANGE_PENDING' },
    })
  const limit = site.billingAccountId ? null : teamSeatLimit(site.plan, site.paidTeamSeats)
  if (limit === null) return
  const [members, invitations] = await Promise.all([
    tx.tenantMembership.count({
      where: {
        clientSiteId,
        deletedAt: null,
        user: { deletedAt: null },
        ...(exclude.userId ? { userId: { not: exclude.userId } } : {}),
      },
    }),
    tx.tenantInvitation.count({
      where: {
        clientSiteId,
        deletedAt: null,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        ...(exclude.invitationId ? { id: { not: exclude.invitationId } } : {}),
        ...(exclude.email ? { email: { not: exclude.email } } : {}),
      },
    }),
  ])
  if (members + invitations >= limit)
    throw createError({ statusCode: 403, message: 'Team seat limit reached', data: { code: 'TEAM_SEAT_LIMIT', limit } })
}

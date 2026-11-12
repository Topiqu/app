export default defineEventHandler(async (event) => {
  const { membership } = await requireTenantMember(event)
  const canControl = hasTenantScope(membership, 'MEMBER_CONTROL')
  const site = await prisma.clientSite.findUniqueOrThrow({
    where: { id: membership.clientSiteId },
    select: { plan: true, paidTeamSeats: true, billingAccountId: true },
  })
  const activeIds = await activeTeamSeatIds(prisma, membership.clientSiteId, site.plan)
  const members = await prisma.tenantMembership.findMany({
    where: { clientSiteId: membership.clientSiteId, deletedAt: null, user: { deletedAt: null } },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      role: true,
      scopes: true,
      createdAt: true,
      billingAccountId: true,
      user: { select: { id: true, username: true, email: true, avatarUrl: true } },
    },
  })
  const invitations = canControl
    ? await prisma.tenantInvitation.findMany({
        where: {
          clientSiteId: membership.clientSiteId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, scopes: true, expiresAt: true, createdAt: true },
      })
    : []
  // An agency pays per blog, not per seat.
  const limit = site.billingAccountId ? null : teamSeatLimit(site.plan, site.paidTeamSeats)
  return {
    members: members.map(({ billingAccountId, ...member }) => ({
      ...member,
      agency: !!billingAccountId,
      seatActive: activeIds === null || activeIds.has(member.id),
    })),
    invitations,
    currentMembershipId: membership.id,
    canControl,
    seats: { limit, used: members.length, reserved: invitations.length },
  }
})

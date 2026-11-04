export default defineEventHandler(async (event) => {
  const { membership } = await requireTenantMember(event)
  const canControl = hasTenantScope(membership, 'MEMBER_CONTROL')
  const site = await prisma.clientSite.findUniqueOrThrow({
    where: { id: membership.clientSiteId },
    select: { plan: true, paidTeamSeats: true },
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
  const limit = teamSeatLimit(site.plan, site.paidTeamSeats)
  return {
    members: members.map((member) => ({ ...member, seatActive: activeIds === null || activeIds.has(member.id) })),
    invitations,
    currentMembershipId: membership.id,
    canControl,
    seats: { limit, used: members.length, reserved: invitations.length },
  }
})

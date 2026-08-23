export default defineEventHandler(async (event) => {
  const { membership } = await requireTenantMember(event)
  const canControl = hasTenantScope(membership, 'MEMBER_CONTROL')
  const members = await prisma.tenantMembership.findMany({
    where: { clientSiteId: membership.clientSiteId, deletedAt: null },
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
  return { members, invitations, currentMembershipId: membership.id, canControl }
})

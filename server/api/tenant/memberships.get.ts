export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const memberships = await prisma.tenantMembership.findMany({
    where: { userId: user.id, deletedAt: null, clientSite: { deletedAt: null } },
    orderBy: { createdAt: 'asc' },
    select: {
      clientSiteId: true,
      id: true,
      role: true,
      clientSite: { select: { name: true, logoUrl: true, domain: true, plan: true } },
    },
  })
  const permitted = await Promise.all(
    memberships.map((membership) => hasTeamSeat(prisma, membership, membership.clientSite.plan)),
  )
  return memberships.filter((_, index) => permitted[index]).map(({ id: _id, ...membership }) => membership)
})

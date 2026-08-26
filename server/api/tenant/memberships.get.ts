export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return prisma.tenantMembership.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: {
      clientSiteId: true,
      role: true,
      clientSite: { select: { name: true, logoUrl: true, domain: true, plan: true } },
    },
  })
})

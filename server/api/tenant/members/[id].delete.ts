export default defineEventHandler(async (event) => {
  const { membership } = await requireTenantScope(event, 'MEMBER_CONTROL')
  const id = getRouterParam(event, 'id')!
  const target = await prisma.tenantMembership.findFirst({
    where: { id, clientSiteId: membership.clientSiteId, deletedAt: null },
  })
  if (!target) throw createError({ statusCode: 404, message: 'Member not found' })
  if (target.role === 'OWNER') throw createError({ statusCode: 403, message: 'Owner cannot be removed' })
  if (target.id === membership.id) throw createError({ statusCode: 400, message: 'You cannot remove yourself' })
  await prisma.tenantMembership.delete({ where: { id } })
  if (target.userId) {
    const user = await prisma.user.findUnique({ where: { id: target.userId }, select: { clientSiteId: true } })
    if (user?.clientSiteId === membership.clientSiteId) {
      const next = await prisma.tenantMembership.findFirst({ where: { userId: target.userId, deletedAt: null }, orderBy: { createdAt: 'asc' }, select: { clientSiteId: true } })
      await prisma.user.update({ where: { id: target.userId }, data: { clientSiteId: next?.clientSiteId ?? null, role: next ? 'admin' : 'reader' } })
    }
  }
  return { ok: true }
})

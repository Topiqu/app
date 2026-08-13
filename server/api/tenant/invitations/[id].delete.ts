export default defineEventHandler(async (event) => {
  const { membership } = await requireTenantScope(event, 'MEMBER_CONTROL')
  const id = getRouterParam(event, 'id')!
  const result = await prisma.tenantInvitation.updateMany({
    where: { id, clientSiteId: membership.clientSiteId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  if (!result.count) throw createError({ statusCode: 404, message: 'Invitation not found' })
  return { ok: true }
})

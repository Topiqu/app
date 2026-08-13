export default defineEventHandler(async (event) => {
  const { user: actor, membership } = await requireTenantScope(event, 'MEMBER_CONTROL')
  const id = getRouterParam(event, 'id')!
  const target = await prisma.tenantMembership.findFirst({
    where: { id, clientSiteId: membership.clientSiteId, deletedAt: null },
  })
  if (!target) throw createError({ statusCode: 404, message: 'Member not found' })
  if (target.role === 'OWNER') throw createError({ statusCode: 403, message: 'Owner cannot be removed' })
  if (target.id === membership.id) throw createError({ statusCode: 400, message: 'You cannot remove yourself' })
  const removedAt = new Date()
  const [user, next, tenant, owner] = await Promise.all([
    prisma.user.findUnique({
      where: { id: target.userId },
      select: { clientSiteId: true, email: true, language: true },
    }),
    prisma.tenantMembership.findFirst({
      where: { userId: target.userId, id: { not: target.id }, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { clientSiteId: true },
    }),
    prisma.clientSite.findUniqueOrThrow({
      where: { id: membership.clientSiteId },
      select: { name: true, logoUrl: true },
    }),
    prisma.tenantMembership.findFirst({
      where: { clientSiteId: membership.clientSiteId, role: 'OWNER', deletedAt: null },
      select: { user: { select: { email: true } } },
    }),
  ])
  await prisma.$transaction([
    prisma.tenantMembership.delete({ where: { id } }),
    prisma.session.updateMany({
      where: { userId: target.userId, clientSiteId: membership.clientSiteId },
      data: { clientSiteId: next?.clientSiteId ?? null },
    }),
    ...(user?.clientSiteId === membership.clientSiteId
      ? [prisma.user.update({ where: { id: target.userId }, data: { clientSiteId: next?.clientSiteId ?? null, role: next ? 'admin' : 'reader' } })]
      : []),
  ])
  await logAction({ action: 'TENANT_MEMBER_REMOVED', userId: actor.id, clientSiteId: membership.clientSiteId, ip: getIp(event), metadata: { membershipId: id, targetUserId: target.userId, scopes: target.scopes } })
  if (user?.email) {
    try {
      const locale = user.language === 'cs' ? 'cs-CZ' : 'en-US'
      await sendEmail({
        event,
        to: user.email,
        template: 'tenantMemberRemoved',
        lang: user.language,
        data: {
          tenantName: tenant.name,
          tenantLogoUrl: tenant.logoUrl ?? '',
          removedBy: actor.name || actor.email,
          removedAt: removedAt.toLocaleString(locale, {
            dateStyle: 'long',
            timeStyle: 'short',
            timeZone: 'Europe/Prague',
          }),
          ownerEmail: owner?.user.email ?? actor.email,
        },
      })
    } catch (error) {
      await logger.error('tenant member removal email failed', {
        source: 'tenant-membership',
        tenantId: membership.clientSiteId,
        targetUserId: target.userId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return { ok: true }
})

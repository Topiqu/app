import { z } from 'zod'
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { clientSiteId } = await readValidatedBody(event, z.object({ clientSiteId: z.string().min(1) }).parse)
  const membership = await prisma.tenantMembership.findUnique({
    where: { clientSiteId_userId: { clientSiteId, userId: user.id } },
    select: {
      id: true,
      role: true,
      clientSiteId: true,
      deletedAt: true,
      clientSite: { select: { domain: true, domainVerified: true, deletedAt: true, plan: true } },
    },
  })
  if (!membership || membership.deletedAt || membership.clientSite.deletedAt)
    throw createError({ statusCode: 403, message: 'Tenant membership required' })
  if (!(await hasTeamSeat(prisma, membership, membership.clientSite.plan)))
    throw createError({ statusCode: 403, message: 'Team seat limit reached', data: { code: 'TEAM_SEAT_LIMIT' } })
  const session = await prisma.session.findFirst({
    where: { id: user.sessionId, userId: user.id },
    select: { clientSiteId: true },
  })
  if (!session) throw createError({ statusCode: 401, message: 'Active session required' })
  await prisma.session.update({ where: { id: user.sessionId }, data: { clientSiteId } })
  await logAction({
    action: 'ACTIVE_TENANT_CHANGED',
    userId: user.id,
    clientSiteId,
    ip: getIp(event),
    metadata: { previousClientSiteId: session.clientSiteId },
  })
  return {
    clientSiteId,
    domain: membership.clientSite.domain,
    domainVerified: membership.clientSite.domainVerified,
  }
})

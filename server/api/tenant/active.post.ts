import { z } from 'zod'
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!user.sessionId) throw createError({ statusCode: 401, message: 'Active session required' })
  const { clientSiteId } = await readValidatedBody(event, z.object({ clientSiteId: z.string().min(1) }).parse)
  const membership = await prisma.tenantMembership.findUnique({ where: { clientSiteId_userId: { clientSiteId, userId: user.id } }, select: { id: true, deletedAt: true } })
  if (!membership || membership.deletedAt) throw createError({ statusCode: 403, message: 'Tenant membership required' })
  const session = await prisma.session.findFirst({ where: { id: user.sessionId, userId: user.id, revoked: false }, select: { clientSiteId: true } })
  if (!session) throw createError({ statusCode: 401, message: 'Active session required' })
  await prisma.session.update({ where: { id: user.sessionId }, data: { clientSiteId } })
  await logAction({ action: 'ACTIVE_TENANT_CHANGED', userId: user.id, clientSiteId, ip: getIp(event), metadata: { previousClientSiteId: session.clientSiteId } })
  return { clientSiteId }
})

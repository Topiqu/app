import { z } from 'zod'
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { clientSiteId } = await readValidatedBody(event, z.object({ clientSiteId: z.string().min(1) }).parse)
  const membership = await prisma.tenantMembership.findUnique({ where: { clientSiteId_userId: { clientSiteId, userId: user.id } }, select: { id: true, deletedAt: true } })
  if (!membership || membership.deletedAt) throw createError({ statusCode: 403, message: 'Tenant membership required' })
  await prisma.user.update({ where: { id: user.id }, data: { clientSiteId, role: 'admin' } })
  return { clientSiteId }
})

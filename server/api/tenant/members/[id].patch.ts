import { z } from 'zod'
const bodySchema = z.object({ scopes: z.array(z.enum(TENANT_SCOPES)).max(TENANT_SCOPES.length) })
export default defineEventHandler(async (event) => {
  const { membership } = await requireTenantScope(event, 'MEMBER_CONTROL')
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, bodySchema.parse)
  const target = await prisma.tenantMembership.findFirst({
    where: { id, clientSiteId: membership.clientSiteId, deletedAt: null },
  })
  if (!target) throw createError({ statusCode: 404, message: 'Member not found' })
  if (target.role === 'OWNER') throw createError({ statusCode: 403, message: 'Owner permissions cannot be changed' })
  if (target.id === membership.id && !body.scopes.includes('MEMBER_CONTROL'))
    throw createError({ statusCode: 400, message: 'You cannot remove your own member control permission' })
  return prisma.tenantMembership.update({
    where: { id },
    data: { scopes: [...new Set(body.scopes)] },
    select: { id: true, scopes: true },
  })
})

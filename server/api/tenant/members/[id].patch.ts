import { z } from 'zod'
const bodySchema = z.object({ scopes: z.array(z.enum(TENANT_SCOPES)).max(TENANT_SCOPES.length) })
export default defineEventHandler(async (event) => {
  const { user, membership } = await requireTenantScope(event, 'MEMBER_CONTROL')
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, bodySchema.parse)
  const target = await prisma.tenantMembership.findFirst({
    where: { id, clientSiteId: membership.clientSiteId, deletedAt: null },
  })
  if (!target) throw createError({ statusCode: 404, message: 'Member not found' })
  if (target.role === 'OWNER') throw createError({ statusCode: 403, message: 'Owner permissions cannot be changed' })
  if (target.id === membership.id && !body.scopes.includes('MEMBER_CONTROL'))
    throw createError({ statusCode: 400, message: 'You cannot remove your own member control permission' })
  const scopes = [...new Set(body.scopes)]
  const addedScopes = scopes.filter((scope) => !target.scopes.includes(scope))
  const removedScopes = target.scopes.filter((scope) => !scopes.includes(scope))
  if (!addedScopes.length && !removedScopes.length) return { id: target.id, scopes: target.scopes }
  const updated = await prisma.tenantMembership.update({
    where: { id },
    data: { scopes },
    select: { id: true, scopes: true },
  })
  await logAction({
    action: 'TENANT_MEMBER_SCOPES_CHANGED',
    userId: user.id,
    clientSiteId: membership.clientSiteId,
    ip: getIp(event),
    metadata: {
      membershipId: id,
      targetUserId: target.userId,
      previousScopes: target.scopes,
      scopes: updated.scopes,
      addedScopes,
      removedScopes,
    },
  })
  return updated
})

import { z } from 'zod'

const Body = z.object({ status: z.enum(['OPEN', 'DISMISSED', 'RESOLVED']) })

export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { clientSite: true })
  await requireTenantScope(event, 'ANALYTICS_READ', user.clientSiteId)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing opportunity ID' })
  const opportunity = await db.aiVisibilityOpportunity.findUnique({
    where: { id },
    select: { id: true, clientSiteId: true },
  })
  if (!opportunity || opportunity.clientSiteId !== user.clientSiteId)
    throw createError({ statusCode: 404, message: 'Opportunity not found' })
  const body = await readValidatedBody(event, Body.parse)
  const updated = await db.aiVisibilityOpportunity.update({
    where: { id },
    data: body,
    select: { id: true, status: true },
  })
  await logAction({
    action: 'AI_VISIBILITY_OPPORTUNITY_UPDATED',
    userId: user.id,
    clientSiteId: user.clientSiteId,
    metadata: updated,
  })
  return updated
})

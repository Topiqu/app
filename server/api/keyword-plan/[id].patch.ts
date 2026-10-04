import { z } from 'zod'
import { KEYWORD_PLAN_EDITABLE_STATUSES } from '~~/shared/utils/keywordPlan'

export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { role: ['admin', 'superadmin'], clientSite: true })
  const clientSiteId = user.clientSiteId!
  if (user.role !== 'superadmin') await requireTenantScope(event, 'AI_USE', clientSiteId)

  const id = getRouterParam(event, 'id')!
  const { status } = await readValidatedBody(event, z.object({ status: z.enum(KEYWORD_PLAN_EDITABLE_STATUSES) }).parse)
  // A USED cluster already has its article; reopening it would invite a duplicate.
  const updated = await db.keywordCluster.updateMany({
    where: { id, clientSiteId, status: { not: 'USED' } },
    data: { status },
  })
  if (!updated.count) throw createError({ statusCode: 404, message: 'Keyword not found' })
  return { status }
})

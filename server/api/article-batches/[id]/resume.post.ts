import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = z.string().uuid().parse(getRouterParam(event, 'id'))
  const { user: member } = await requireTenantMember(event)
  const batch = member.clientSiteId
    ? await prisma.articleBatch.findFirst({
        where: { id, clientSiteId: member.clientSiteId, status: 'ACTIVE', deletedAt: null },
        select: { mode: true },
      })
    : null
  if (!batch) throw createError({ statusCode: 404 })
  // The batch runs under the member who resumes it, so that member needs what its mode needs.
  const { user, clientSiteId } = await requireArticleBatchAccess(event, batch.mode)
  await resumeArticleBatch(id, clientSiteId, user.id)
  return { ok: true }
})

import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { user, clientSiteId } = await requireArticleBatchAccess(event)
  const id = z.string().uuid().parse(getRouterParam(event, 'id'))
  await cancelArticleBatch(id, clientSiteId, user.id)
  return { ok: true }
})

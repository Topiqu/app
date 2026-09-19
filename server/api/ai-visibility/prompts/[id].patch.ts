import { z } from 'zod'

const Body = z.object({ active: z.boolean() })

export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { clientSite: true })
  await requireTenantScope(event, 'AI_USE', user.clientSiteId)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing prompt ID' })
  const prompt = await db.aiVisibilityPrompt.findUnique({ where: { id }, select: { id: true, clientSiteId: true } })
  if (!prompt || prompt.clientSiteId !== user.clientSiteId)
    throw createError({ statusCode: 404, message: 'Prompt not found' })
  const body = await readValidatedBody(event, Body.parse)
  const updated = await db.aiVisibilityPrompt.update({ where: { id }, data: body, select: { id: true, active: true } })
  await logAction({
    action: 'AI_VISIBILITY_PROMPT_UPDATED',
    userId: user.id,
    clientSiteId: user.clientSiteId,
    metadata: updated,
  })
  return updated
})
